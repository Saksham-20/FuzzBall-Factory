import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { validationFailed } from '../errors.js';

const KEY_PATTERN = /^[A-Za-z0-9_\-:.]{8,128}$/;

/** Reads the `Idempotency-Key` header. Returns undefined when absent; throws 400 when malformed. */
export const IdempotencyKeyHeader = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const raw = ctx.switchToHttp().getRequest<Request>().headers['idempotency-key'];
  const value = typeof raw === 'string' ? raw.trim() : undefined;
  if (!value) return undefined;
  if (!KEY_PATTERN.test(value)) {
    throw validationFailed({ 'Idempotency-Key': 'Use 8-128 letters, numbers, dashes, dots or colons.' }, 'Invalid Idempotency-Key header.');
  }
  return value;
});
