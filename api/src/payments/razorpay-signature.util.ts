import { createHmac } from 'node:crypto';
import { safeEqualHex } from '../common/hashing.service.js';

export const hmacSha256Hex = (secret: string, payload: string | Buffer): string => createHmac('sha256', secret).update(payload).digest('hex');

/**
 * Checkout callback signature: HMAC-SHA256(`${razorpay_order_id}|${razorpay_payment_id}`, key_secret), hex.
 * Constant-time comparison; any malformed input is simply "invalid".
 */
export function verifyPaymentSignature(args: { orderId: string; paymentId: string; signature: string; secret: string }): boolean {
  if (!args.orderId || !args.paymentId || !args.signature || !args.secret) return false;
  return safeEqualHex(hmacSha256Hex(args.secret, `${args.orderId}|${args.paymentId}`), args.signature.toLowerCase());
}

/** Webhook signature: HMAC-SHA256(raw request body, webhook secret), hex, from the `X-Razorpay-Signature` header. */
export function verifyWebhookSignature(rawBody: Buffer | string, signature: string | undefined, secret: string | undefined): boolean {
  if (!signature || !secret || rawBody.length === 0) return false;
  return safeEqualHex(hmacSha256Hex(secret, rawBody), signature.toLowerCase());
}
