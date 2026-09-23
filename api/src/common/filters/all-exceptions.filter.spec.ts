import { BadRequestException, ForbiddenException, HttpException, NotFoundException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { INTERNAL_MESSAGE, toErrorResponse } from './all-exceptions.filter.js';
import { conflict, ErrorCode, notFound, validationFailed } from '../errors.js';
import { createValidationPipe } from '../validation.js';
import { IsEmail, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

describe('toErrorResponse', () => {
  it('passes AppException through as { code, message, fields } with its status', () => {
    const r = toErrorResponse(conflict('An account with this email already exists.', { email: 'Already registered' }, ErrorCode.EMAIL_TAKEN));
    expect(r.status).toBe(409);
    expect(r.body).toEqual({ code: 'EMAIL_TAKEN', message: 'An account with this email already exists.', fields: { email: 'Already registered' } });
    expect(r.log).toBeUndefined();
  });

  it('omits `fields` when there are none', () => {
    expect(toErrorResponse(notFound('Order not found.'))).toEqual({ status: 404, body: { code: 'NOT_FOUND', message: 'Order not found.' } });
  });

  it('maps Nest HttpExceptions to codes by status', () => {
    expect(toErrorResponse(new NotFoundException()).body.code).toBe('NOT_FOUND');
    expect(toErrorResponse(new ForbiddenException('nope'))).toEqual({ status: 403, body: { code: 'FORBIDDEN', message: 'nope' } });
    expect(toErrorResponse(new BadRequestException(['a', 'b'])).body.message).toBe('a; b');
  });

  it('gives 429 a friendly message instead of "ThrottlerException"', () => {
    const r = toErrorResponse(new ThrottlerException());
    expect(r.status).toBe(429);
    expect(r.body.code).toBe('RATE_LIMITED');
    expect(r.body.message).not.toMatch(/Throttler/);
  });

  it('turns unknown errors into a generic 500 with no internals leaked, and asks for logging', () => {
    const r = toErrorResponse(new Error('connect ECONNREFUSED 127.0.0.1:5432 password=hunter2'));
    expect(r.status).toBe(500);
    expect(r.body).toEqual({ code: 'INTERNAL', message: INTERNAL_MESSAGE });
    expect(JSON.stringify(r.body)).not.toMatch(/ECONNREFUSED|hunter2/);
    expect(r.log).toBeInstanceOf(Error);
  });

  it('maps Prisma unique violations to 409 and missing rows to 404', () => {
    expect(toErrorResponse({ name: 'PrismaClientKnownRequestError', code: 'P2002' }).status).toBe(409);
    expect(toErrorResponse({ name: 'PrismaClientKnownRequestError', code: 'P2025' }).status).toBe(404);
    expect(toErrorResponse({ name: 'PrismaClientKnownRequestError', code: 'P2003' }).status).toBe(500);
  });

  it('exposes body-parser 4xx errors but not their raw message', () => {
    const r = toErrorResponse({ status: 413, expose: true, message: 'request entity too large' });
    expect(r.status).toBe(413);
    expect(r.body.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('handles string-response HttpExceptions', () => {
    expect(toErrorResponse(new HttpException('teapot', 418)).body.message).toBe('teapot');
  });
});

describe('validation pipe error shape', () => {
  class Inner {
    @IsString() line1!: string;
  }
  class Dto {
    @IsEmail() email!: string;
    @ValidateNested() @Type(() => Inner) address!: Inner;
  }

  it('returns 400 VALIDATION_FAILED with per-field messages, including nested paths', async () => {
    const pipe = createValidationPipe();
    const err = await pipe.transform({ email: 'x', address: {}, extra: 1 }, { type: 'body', metatype: Dto }).catch((e: unknown) => e);
    const r = toErrorResponse(err);
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(r.body.fields ?? {}).sort()).toEqual(['address.line1', 'email', 'extra']);
    expect(r.body.fields?.extra).toBe('Not allowed');
  });

  it('validationFailed builds the same shape by hand', () => {
    expect(toErrorResponse(validationFailed({ qty: 'Too many' })).body).toEqual({ code: 'VALIDATION_FAILED', message: 'Some details need another look.', fields: { qty: 'Too many' } });
  });
});
