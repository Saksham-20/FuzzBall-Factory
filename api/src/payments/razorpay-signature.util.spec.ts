import { hmacSha256Hex, verifyPaymentSignature, verifyWebhookSignature } from './razorpay-signature.util.js';

const SECRET = 'test_key_secret';

describe('verifyPaymentSignature (checkout callback)', () => {
  const sign = (orderId: string, paymentId: string, secret = SECRET) => hmacSha256Hex(secret, `${orderId}|${paymentId}`);

  it('accepts HMAC-SHA256 of "order_id|payment_id"', () => {
    expect(verifyPaymentSignature({ orderId: 'order_A', paymentId: 'pay_B', signature: sign('order_A', 'pay_B'), secret: SECRET })).toBe(true);
  });

  it('uses standard HMAC-SHA256 (RFC 4231-style known vector)', () => {
    expect(hmacSha256Hex('key', 'The quick brown fox jumps over the lazy dog')).toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
  });

  it('rejects a signature for another payment, another order, or another secret', () => {
    const good = sign('order_A', 'pay_B');
    expect(verifyPaymentSignature({ orderId: 'order_A', paymentId: 'pay_X', signature: good, secret: SECRET })).toBe(false);
    expect(verifyPaymentSignature({ orderId: 'order_X', paymentId: 'pay_B', signature: good, secret: SECRET })).toBe(false);
    expect(verifyPaymentSignature({ orderId: 'order_A', paymentId: 'pay_B', signature: sign('order_A', 'pay_B', 'other'), secret: SECRET })).toBe(false);
  });

  it('rejects malformed, empty and wrong-length signatures without throwing', () => {
    for (const signature of ['', 'zzzz', 'abc', 'not-hex-at-all!!', sign('order_A', 'pay_B').slice(0, -2)]) {
      expect(verifyPaymentSignature({ orderId: 'order_A', paymentId: 'pay_B', signature, secret: SECRET })).toBe(false);
    }
    expect(verifyPaymentSignature({ orderId: '', paymentId: 'pay_B', signature: 'ab', secret: SECRET })).toBe(false);
    expect(verifyPaymentSignature({ orderId: 'order_A', paymentId: 'pay_B', signature: sign('order_A', 'pay_B'), secret: '' })).toBe(false);
  });

  it('is case-insensitive about the hex digits', () => {
    expect(verifyPaymentSignature({ orderId: 'order_A', paymentId: 'pay_B', signature: sign('order_A', 'pay_B').toUpperCase(), secret: SECRET })).toBe(true);
  });
});

describe('verifyWebhookSignature (raw body)', () => {
  const body = Buffer.from(JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1' } } } }));

  it('accepts the HMAC of the exact raw bytes', () => {
    expect(verifyWebhookSignature(body, hmacSha256Hex('whsec', body), 'whsec')).toBe(true);
  });

  it('rejects a body that changed by a single byte (re-serialised JSON is not the same bytes)', () => {
    const sig = hmacSha256Hex('whsec', body);
    expect(verifyWebhookSignature(Buffer.from(`${body.toString()} `), sig, 'whsec')).toBe(false);
    expect(verifyWebhookSignature(Buffer.from(JSON.stringify(JSON.parse(body.toString()), null, 2)), sig, 'whsec')).toBe(false);
  });

  it('rejects missing signature, missing secret, empty body and the wrong secret', () => {
    const sig = hmacSha256Hex('whsec', body);
    expect(verifyWebhookSignature(body, undefined, 'whsec')).toBe(false);
    expect(verifyWebhookSignature(body, sig, undefined)).toBe(false);
    expect(verifyWebhookSignature(Buffer.alloc(0), hmacSha256Hex('whsec', ''), 'whsec')).toBe(false);
    expect(verifyWebhookSignature(body, sig, 'other')).toBe(false);
  });
});
