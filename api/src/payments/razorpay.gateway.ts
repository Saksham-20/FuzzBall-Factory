import Razorpay from 'razorpay';
import { withTimeout } from '../common/timeout.js';

/** Deadlines for Razorpay calls. A timeout means the outcome is unknown: callers must reconcile, never blindly retry. */
export const RAZORPAY_ORDER_TIMEOUT_MS = 10_000;
export const RAZORPAY_REFUND_TIMEOUT_MS = 15_000;

/**
 * The only file that talks to the Razorpay SDK. Amounts here are PAISE (the API's unit); the rest of the
 * app works in whole rupees and converts at this boundary (`PaymentsService`).
 * Kept behind an interface so tests substitute a fake and mock mode needs no network.
 */
export interface RazorpayGateway {
  createOrder(args: { amountPaise: number; receipt: string; notes?: Record<string, string> }): Promise<{ id: string }>;
  refund(paymentId: string, args: { amountPaise: number; notes?: Record<string, string>; receipt?: string }): Promise<{ id: string; status: string }>;
}

export const RAZORPAY_GATEWAY = Symbol('RAZORPAY_GATEWAY');

export class SdkRazorpayGateway implements RazorpayGateway {
  private readonly client: Razorpay;

  constructor(keyId: string, keySecret: string) {
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async createOrder(args: { amountPaise: number; receipt: string; notes?: Record<string, string> }) {
    const order = await withTimeout(this.client.orders.create({ amount: args.amountPaise, currency: 'INR', receipt: args.receipt, notes: args.notes }), RAZORPAY_ORDER_TIMEOUT_MS, 'Razorpay order creation');
    return { id: order.id };
  }

  async refund(paymentId: string, args: { amountPaise: number; notes?: Record<string, string>; receipt?: string }) {
    const r = await withTimeout(this.client.payments.refund(paymentId, { amount: args.amountPaise, speed: 'normal', notes: args.notes, receipt: args.receipt }), RAZORPAY_REFUND_TIMEOUT_MS, 'Razorpay refund');
    return { id: r.id, status: String((r as { status?: string }).status ?? 'pending') };
  }
}
