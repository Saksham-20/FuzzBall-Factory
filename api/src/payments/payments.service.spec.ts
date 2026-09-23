import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { PaymentsService, redactWebhookPayload } from './payments.service.js';
import type { RazorpayGateway } from './razorpay.gateway.js';

const config = (env: Partial<Env>) => ({ get: (k: keyof Env) => env[k] }) as unknown as ConfigService<Env, true>;
const gateway: RazorpayGateway = { createOrder: () => Promise.resolve({ id: 'order_x' }), refund: () => Promise.resolve({ id: 'rfnd_x', status: 'processed' }) };
const make = (env: Partial<Env>, gw: RazorpayGateway | null) => new PaymentsService({} as PrismaService, config(env), gw);

describe('PaymentsService mode (the mock switch)', () => {
  it('is mock without keys outside production', () => {
    const s = make({ NODE_ENV: 'development' }, null);
    expect(s.mode).toBe('mock');
    expect(s.mockEnabled).toBe(true);
    expect(make({ NODE_ENV: 'test' }, null).mockEnabled).toBe(true);
  });

  it('is disabled (never mock) without keys in production', () => {
    const s = make({ NODE_ENV: 'production' }, null);
    expect(s.mode).toBe('disabled');
    expect(s.mockEnabled).toBe(false);
  });

  it('is live when keys exist, in any environment: mock is impossible', () => {
    for (const NODE_ENV of ['development', 'test', 'production'] as const) {
      const s = make({ NODE_ENV, RAZORPAY_KEY_ID: 'rzp_test_1', RAZORPAY_KEY_SECRET: 'sec' }, gateway);
      expect(s.mode).toBe('live');
      expect(s.mockEnabled).toBe(false);
    }
  });

  it('mockConfirm answers 404 (before touching the database) when mock is not enabled', async () => {
    const live = make({ NODE_ENV: 'development', RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }, gateway);
    await expect(live.mockConfirm('whatever', true)).rejects.toMatchObject({ status: 404 });
    const prod = make({ NODE_ENV: 'production' }, null);
    await expect(prod.mockConfirm('whatever', true)).rejects.toMatchObject({ status: 404 });
  });

  it('createPayment refuses to run without keys in production', async () => {
    const prod = make({ NODE_ENV: 'production' }, null);
    await expect(prod.createPayment({ purpose: 'ORDER', amount: 500, orderId: 'o1', receipt: 'FB-1' })).rejects.toMatchObject({ status: 503 });
  });

  it('createPayment rejects non-integer or sub-rupee amounts', async () => {
    const s = make({ NODE_ENV: 'test' }, null);
    for (const amount of [0, -5, 10.5]) {
      await expect(s.createPayment({ purpose: 'ORDER', amount, orderId: 'o1', receipt: 'FB-1' })).rejects.toMatchObject({ status: 400 });
    }
  });
});

describe('webhook guards', () => {
  it('answers 503 when no webhook secret is configured, and 400 for a bad signature', async () => {
    const s = make({ NODE_ENV: 'test', RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }, gateway);
    await expect(s.handleWebhook(Buffer.from('{}'), 'abc', 'evt_1')).rejects.toMatchObject({ status: 503 });
    const withSecret = make({ NODE_ENV: 'test', RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's', RAZORPAY_WEBHOOK_SECRET: 'wh' }, gateway);
    await expect(withSecret.handleWebhook(Buffer.from('{}'), 'deadbeef', 'evt_1')).rejects.toMatchObject({ status: 400, response: { code: 'INVALID_SIGNATURE' } });
    await expect(withSecret.handleWebhook(undefined, undefined, undefined)).rejects.toMatchObject({ status: 400 });
  });
});

describe('redactWebhookPayload', () => {
  it('drops customer identifiers before a payload is stored', () => {
    const out = redactWebhookPayload({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', email: 'a@b.c', contact: '+911', notes: { x: 1 }, card: { last4: '1111' }, amount: 100 } } } });
    expect(out).toEqual({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1', email: '[redacted]', contact: '[redacted]', notes: '[redacted]', card: '[redacted]', amount: 100 } } } });
  });
});

describe('describeGatewayError', () => {
  it('reads Razorpay SDK rejections (plain objects) as well as Errors', async () => {
    const { describeGatewayError } = await import('./payments.service.js');
    expect(describeGatewayError(new Error('boom'))).toBe('boom');
    expect(describeGatewayError({ statusCode: 400, error: { code: 'BAD_REQUEST_ERROR', description: 'Amount too low' } })).toBe('BAD_REQUEST_ERROR: Amount too low (HTTP 400)');
    expect(describeGatewayError(undefined)).toBe('unknown gateway error');
  });
});

describe('createPayment when the gateway rejects', () => {
  it('answers 502 with a friendly message and never leaks the gateway error', async () => {
    const failing: RazorpayGateway = { createOrder: () => Promise.reject({ statusCode: 500, error: { code: 'SERVER_ERROR', description: 'secret internal detail' } }), refund: () => Promise.resolve({ id: 'r', status: 'processed' }) };
    const s = make({ NODE_ENV: 'test', RAZORPAY_KEY_ID: 'k', RAZORPAY_KEY_SECRET: 's' }, failing);
    const err: unknown = await s.createPayment({ purpose: 'ORDER', amount: 500, orderId: 'o1', receipt: 'FB-1' }).then(
      () => undefined,
      (e: unknown) => e,
    );
    expect(err).toMatchObject({ status: 502, response: { code: 'PAYMENT_FAILED' } });
    expect(JSON.stringify((err as { response: unknown }).response)).not.toContain('secret internal detail');
  });
});
