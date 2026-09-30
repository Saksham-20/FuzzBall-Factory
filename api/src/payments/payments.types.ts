/**
 * Contract between the payments module (owned by the commerce agent) and the domain modules
 * that take payments (orders, custom work orders). Do not change without updating both sides.
 *
 * Money is whole rupees (Int) everywhere except when talking to Razorpay (paise).
 */
import type { Prisma } from '../generated/prisma/client.js';

export type PaymentPurpose = 'ORDER' | 'DEPOSIT' | 'BALANCE';

export interface CreatePaymentInput {
  purpose: PaymentPurpose;
  /** Whole rupees. */
  amount: number;
  /** Set for ORDER payments. */
  orderId?: string;
  /** Set for DEPOSIT / BALANCE payments. */
  customRequestId?: string;
  userId?: string;
  /** Human reference, e.g. "FB-1023" or "WO-029-deposit". */
  receipt: string;
}

/** What the web checkout needs to open Razorpay (or the dev "test payment" modal when `mock` is true). */
export interface CheckoutPayment {
  paymentId: string;
  razorpayOrderId: string;
  keyId: string;
  amountPaise: number;
  currency: 'INR';
  /** True when PAYMENTS_MODE is mock (never with live payments): confirm via POST /payments/mock/:paymentId/confirm. */
  mock: boolean;
}

export interface PaidEvent {
  paymentId: string;
  purpose: PaymentPurpose;
  orderId?: string;
  customRequestId?: string;
  razorpayPaymentId: string;
}

/** Runs after the transaction that marked the Payment PAID has committed. */
export type PaidListener = (event: PaidEvent) => Promise<void>;

/** Runs inside the same DB transaction that marks the Payment PAID. Must be idempotent. */
export type PaidHandler = (event: PaidEvent, tx: Prisma.TransactionClient) => Promise<void>;

/**
 * Implemented by PaymentsService (commerce agent):
 *   createPayment(input: CreatePaymentInput): Promise<CheckoutPayment>
 *   registerPaidHandler(purpose: PaymentPurpose, handler: PaidHandler): void   // call from onModuleInit
 * Domain modules call createPayment when the customer must pay and register a handler that
 * advances their own state machine when the payment is captured (verify endpoint or webhook or mock confirm).
 */
export interface PaymentsPort {
  createPayment(input: CreatePaymentInput): Promise<CheckoutPayment>;
  registerPaidHandler(purpose: PaymentPurpose, handler: PaidHandler): void;
  /** Post-commit hook (emails, automatic refunds). Errors are logged, never thrown. */
  registerPaidListener(purpose: PaymentPurpose, listener: PaidListener): void;
  /** `refunded` = rupees Razorpay confirmed, `pending` = rupees queued for retry. Throws when it can't even be attempted. */
  refundPayment(paymentId: string, opts: { amount?: number; reason: string }): Promise<{ refunded: number; pending: number }>;
}

export const PAYMENTS_PORT = Symbol('PAYMENTS_PORT');
