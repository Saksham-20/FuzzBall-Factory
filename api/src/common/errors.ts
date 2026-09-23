import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Stable machine-readable codes. The web maps HTTP status + `message` (+ `fields`) into its ApiError;
 * `code` is for programmatic branching (e.g. show the "sold out" UI).
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  TOKEN_REUSED: 'TOKEN_REUSED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  PHONE_TAKEN: 'PHONE_TAKEN',
  INVALID_RESET_TOKEN: 'INVALID_RESET_TOKEN',
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  IDEMPOTENCY_KEY_REUSED: 'IDEMPOTENCY_KEY_REUSED',
  IDEMPOTENCY_IN_PROGRESS: 'IDEMPOTENCY_IN_PROGRESS',
  UNPROCESSABLE: 'UNPROCESSABLE',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  BAD_REQUEST: 'BAD_REQUEST',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode] | (string & {});

export type FieldErrors = Record<string, string>;

/** Wire format of every error response (the exception filter guarantees this shape). */
export interface ErrorBody {
  code: string;
  message: string;
  fields?: FieldErrors;
}

/** Throw this (or the helpers below) from services. Never throw bare `Error` for expected failures. */
export class AppException extends HttpException {
  constructor(
    status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly fields?: FieldErrors,
  ) {
    super({ code, message, ...(fields ? { fields } : {}) } satisfies ErrorBody, status);
  }
}

export const badRequest = (message: string, fields?: FieldErrors, code: ErrorCode = ErrorCode.BAD_REQUEST) =>
  new AppException(HttpStatus.BAD_REQUEST, code, message, fields);
export const validationFailed = (fields: FieldErrors, message = 'Some details need another look.') =>
  new AppException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, message, fields);
export const unauthorized = (message = 'Please log in to continue.', code: ErrorCode = ErrorCode.UNAUTHENTICATED) =>
  new AppException(HttpStatus.UNAUTHORIZED, code, message);
export const forbidden = (message = "You don't have access to that.") =>
  new AppException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN, message);
export const notFound = (message = "We couldn't find that.") =>
  new AppException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND, message);
export const conflict = (message: string, fields?: FieldErrors, code: ErrorCode = ErrorCode.CONFLICT) =>
  new AppException(HttpStatus.CONFLICT, code, message, fields);
export const unprocessable = (message: string, code: ErrorCode = ErrorCode.UNPROCESSABLE, fields?: FieldErrors) =>
  new AppException(HttpStatus.UNPROCESSABLE_ENTITY, code, message, fields);
export const invalidTransition = (from: string, to: string) =>
  new AppException(HttpStatus.CONFLICT, ErrorCode.INVALID_TRANSITION, `That can't move from ${from} to ${to}.`);
