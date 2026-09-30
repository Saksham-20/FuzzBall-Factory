import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { Env } from '../config/env.js';

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** Honours a sane inbound `x-request-id` (set by nginx) and otherwise mints one; always echoed on the response. */
export function requestId(req: IncomingMessage, res: ServerResponse): string {
  const inbound = req.headers['x-request-id'];
  const id = typeof inbound === 'string' && REQUEST_ID.test(inbound) ? inbound : randomUUID();
  res.setHeader('x-request-id', id);
  return id;
}

/** Credentials and personal data that must never reach a log line. Paths are pino-redact paths. */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-razorpay-signature"]',
  'res.headers["set-cookie"]',
];

/** Path without the query string: tokens and phone numbers ride in queries on some routes. */
export function pathOnly(url: string | undefined): string {
  return (url ?? '').split('?')[0] ?? '';
}

/** nestjs-pino settings: one JSON line per request with the request id, redacted, quiet health checks. */
export function loggerParams(env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      genReqId: requestId,
      redact: { paths: REDACT_PATHS, censor: '[redacted]' },
      autoLogging: { ignore: (req) => pathOnly(req.url).startsWith('/health') },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      serializers: {
        req: (req: { id: string; method: string; url: string; remoteAddress?: string }) => ({ id: req.id, method: req.method, url: pathOnly(req.url), remoteAddress: req.remoteAddress }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
      // Human-readable only on a developer laptop; servers get JSON for the log shipper.
      transport: env.NODE_ENV === 'development' ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } } : undefined,
    },
  };
}
