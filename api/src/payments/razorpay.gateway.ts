import Razorpay from 'razorpay';

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
    const order = await this.client.orders.create({ amount: args.amountPaise, currency: 'INR', receipt: args.receipt, notes: args.notes });
    return { id: order.id };
  }

  async refund(paymentId: string, args: { amountPaise: number; notes?: Record<string, string>; receipt?: string }) {
    const r = await this.client.payments.refund(paymentId, { amount: args.amountPaise, speed: 'normal', notes: args.notes, receipt: args.receipt });
    return { id: r.id, status: String((r as { status?: string }).status ?? 'pending') };
  }
}
