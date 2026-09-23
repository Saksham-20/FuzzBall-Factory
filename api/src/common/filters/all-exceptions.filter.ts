import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ErrorCode, type ErrorBody } from '../errors.js';

const CODE_BY_STATUS: Record<number, string> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHENTICATED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  409: ErrorCode.CONFLICT,
  413: ErrorCode.PAYLOAD_TOO_LARGE,
  422: ErrorCode.UNPROCESSABLE,
  429: ErrorCode.RATE_LIMITED,
};

const FRIENDLY: Record<number, string> = {
  400: "That request didn't look right.",
  401: 'Please log in to continue.',
  403: "You don't have access to that.",
  404: "We couldn't find that.",
  409: 'That conflicts with something that already exists.',
  413: 'That upload is too large.',
  429: 'Too many attempts. Please wait a minute and try again.',
};

export const INTERNAL_MESSAGE = 'Something went wrong on our side. Please try again.';

/** Build `{ code, message, fields? }` and the HTTP status for any thrown value. Pure, so it is unit-tested directly. */
export function toErrorResponse(exception: unknown): { status: number; body: ErrorBody; log?: unknown } {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const res = exception.getResponse();
    // 429/413 come from framework internals with unhelpful text ("ThrottlerException: Too Many Requests").
    if ((status === 429 || status === 413) && !(res && typeof res === 'object' && 'code' in res)) {
      return { status, body: { code: CODE_BY_STATUS[status], message: FRIENDLY[status] } };
    }
    if (typeof res === 'object' && res !== null) {
      const r = res as Record<string, unknown>;
      // AppException (and the ValidationPipe factory) already produce our shape.
      if (typeof r.code === 'string' && typeof r.message === 'string') {
        const fields = r.fields && typeof r.fields === 'object' ? (r.fields as Record<string, string>) : undefined;
        return { status, body: { code: r.code, message: r.message, ...(fields ? { fields } : {}) } };
      }
      const raw = Array.isArray(r.message) ? r.message.join('; ') : r.message;
      const message = typeof raw === 'string' && raw ? raw : (FRIENDLY[status] ?? exception.message);
      return { status, body: { code: CODE_BY_STATUS[status] ?? ErrorCode.BAD_REQUEST, message } };
    }
    return {
      status,
      body: { code: CODE_BY_STATUS[status] ?? ErrorCode.BAD_REQUEST, message: typeof res === 'string' && res ? res : (FRIENDLY[status] ?? exception.message) },
    };
  }

  const err = exception as { name?: string; code?: string; status?: number; statusCode?: number; expose?: boolean; meta?: { target?: unknown } } | null;

  // Prisma known request errors (duck-typed to keep this file free of the generated client).
  if (err?.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') return { status: 409, body: { code: ErrorCode.CONFLICT, message: 'That already exists.' }, log: exception };
    if (err.code === 'P2025') return { status: 404, body: { code: ErrorCode.NOT_FOUND, message: FRIENDLY[404] } };
  }

  // body-parser / http-errors (malformed JSON, payload too large): safe to expose their 4xx.
  const status = err?.status ?? err?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500 && err?.expose) {
    return { status, body: { code: CODE_BY_STATUS[status] ?? ErrorCode.BAD_REQUEST, message: FRIENDLY[status] ?? FRIENDLY[400] } };
  }

  // Never leak internals: no stack, no error message.
  return { status: HttpStatus.INTERNAL_SERVER_ERROR, body: { code: ErrorCode.INTERNAL, message: INTERNAL_MESSAGE }, log: exception };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { status, body, log } = toErrorResponse(exception);
    if (log) {
      const e = log as Error;
      this.logger.error(e?.message ?? JSON.stringify(log), e?.stack);
    }
    const { httpAdapter } = this.httpAdapterHost;
    httpAdapter.reply(host.switchToHttp().getResponse(), body, status);
  }
}
