import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isProduction, type Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { PaymentStatus } from '../generated/prisma/enums.js';
import { AppException, badRequest, conflict, ErrorCode, notFound } from '../common/errors.js';
import type { CheckoutPayment, CreatePaymentInput, PaidEvent, PaidHandler, PaymentPurpose, PaymentsPort } from './payments.types.js';
import { RAZORPAY_GATEWAY, type RazorpayGateway } from './razorpay.gateway.js';
import { verifyPaymentSignature, verifyWebhookSignature } from './razorpay-signature.util.js';

/** 'live' = real Razorpay keys; 'mock' = no keys outside production (dev "test payment"); 'disabled' = no keys in production. */
export type PaymentMode = 'live' | 'mock' | 'disabled';

export const MOCK_ORDER_PREFIX = 'order_mock_';
export const MOCK_KEY_ID = 'rzp_test_mock';
export const PAYMENT_FAILED_MESSAGE = "The payment didn't go through. You haven't been charged. Please try again.";

/** What verify / mock-confirm return. The caller reads the domain object (order, work order) by its number. */
export interface PaymentResult {
  paymentId: string;
  status: PaymentStatus;
  purpose: PaymentPurpose;
  orderNumber?: string;
  customRequestNumber?: string;
  /** False when this call was the one that captured the payment; true for a replay (verify + webhook both arrived). */
  alreadyProcessed: boolean;
}

export type PaidListener = (event: PaidEvent) => Promise<void>;

interface WebhookBody {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; error_description?: string; error_reason?: string } };
    order?: { entity?: { id?: string } };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number; status?: string } };
  };
}

const PII_KEYS = new Set(['email', 'contact', 'vpa', 'card', 'card_id', 'wallet', 'bank', 'notes']);
/** Webhook payloads are stored for debugging: drop customer identifiers first (data minimisation). */
export function redactWebhookPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactWebhookPayload);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, PII_KEYS.has(k) ? '[redacted]' : redactWebhookPayload(v)]));
  }
  return value;
}

const paise = (rupees: number) => Math.round(rupees * 100);

/** The Razorpay SDK rejects with plain objects (`{ statusCode, error: { code, description } }`), not Errors. */
export function describeGatewayError(err: unknown): string {
  if (err instanceof Error) return err.message;
  const e = err as { statusCode?: number; error?: { code?: string; description?: string } } | null;
  if (e?.error?.description) return `${e.error.code ?? 'ERROR'}: ${e.error.description}${e.statusCode ? ` (HTTP ${e.statusCode})` : ''}`;
  return typeof err === 'string' ? err : 'unknown gateway error';
}
const toJson = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;

/**
 * Razorpay Orders API + verification + webhooks + refunds, for every kind of payment (ORDER, DEPOSIT, BALANCE).
 * Implements `PaymentsPort` (see payments.types.ts). Domain modules:
 *   - call `createPayment` when the customer must pay,
 *   - `registerPaidHandler(purpose, handler)` in `onModuleInit` to advance their state machine. The handler runs
 *     inside the SAME transaction that marks the Payment PAID (verify endpoint, webhook and mock-confirm all
 *     go through `markPaid`), and must be idempotent,
 *   - optionally `registerPaidListener(purpose, listener)` for post-commit work (emails).
 * Money is rupees everywhere except inside `createPayment` / `refundPayment`, which convert to paise.
 */
@Injectable()
export class PaymentsService implements PaymentsPort {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly handlers = new Map<PaymentPurpose, PaidHandler[]>();
  private readonly listeners = new Map<PaymentPurpose, PaidListener[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @Inject(RAZORPAY_GATEWAY) private readonly gateway: RazorpayGateway | null,
  ) {}

  // ───────────── mode ─────────────

  get mode(): PaymentMode {
    if (this.gateway && this.keySecret) return 'live';
    return isProduction({ NODE_ENV: this.config.get('NODE_ENV', { infer: true }) }) ? 'disabled' : 'mock';
  }

  private get keyId() {
    return this.config.get('RAZORPAY_KEY_ID', { infer: true });
  }
  private get keySecret() {
    return this.config.get('RAZORPAY_KEY_SECRET', { infer: true });
  }

  // ───────────── registration ─────────────

  registerPaidHandler(purpose: PaymentPurpose, handler: PaidHandler): void {
    this.handlers.set(purpose, [...(this.handlers.get(purpose) ?? []), handler]);
  }

  /** Post-commit hook (send emails here, never in the handler). Errors are logged, never thrown. */
  registerPaidListener(purpose: PaymentPurpose, listener: PaidListener): void {
    this.listeners.set(purpose, [...(this.listeners.get(purpose) ?? []), listener]);
  }

  // ───────────── create ─────────────

  async createPayment(input: CreatePaymentInput): Promise<CheckoutPayment> {
    if (!Number.isInteger(input.amount) || input.amount < 1) throw badRequest('Payment amount must be at least ₹1.');
    if (input.purpose === 'ORDER' ? !input.orderId : !input.customRequestId) throw new Error(`createPayment(${input.purpose}) is missing its owner id`);
    const mode = this.mode;
    if (mode === 'disabled') throw new AppException(503, ErrorCode.PAYMENT_FAILED, "Online payments aren't available right now. Please try again later or message us on WhatsApp.");

    const receipt = input.receipt.slice(0, 40);
    let razorpayOrderId: string;
    if (mode === 'live') {
      try {
        const order = await this.gateway!.createOrder({
          amountPaise: paise(input.amount),
          receipt,
          notes: { purpose: input.purpose, ...(input.orderId ? { orderId: input.orderId } : {}), ...(input.customRequestId ? { customRequestId: input.customRequestId } : {}) },
        });
        razorpayOrderId = order.id;
      } catch (err) {
        this.logger.error(`Razorpay order creation failed for ${receipt}: ${describeGatewayError(err)}`);
        throw new AppException(502, ErrorCode.PAYMENT_FAILED, "We couldn't start the payment just now. Nothing was charged. Please try again in a moment.");
      }
    } else {
      razorpayOrderId = `${MOCK_ORDER_PREFIX}${randomBytes(9).toString('base64url')}`;
    }

    const row = await this.prisma.payment.create({
      data: {
        purpose: input.purpose,
        amount: input.amount,
        orderId: input.orderId,
        requestId: input.customRequestId,
        razorpayOrderId,
        status: 'PENDING',
        method: 'RAZORPAY',
      },
    });
    return { paymentId: row.id, razorpayOrderId, keyId: mode === 'live' ? (this.keyId as string) : MOCK_KEY_ID, amountPaise: paise(input.amount), currency: 'INR', mock: mode === 'mock' };
  }

  // ───────────── verify (checkout callback) ─────────────

  async verify(input: { razorpayOrderId: string; razorpayPaymentId: string; signature: string }): Promise<PaymentResult> {
    const secret = this.keySecret;
    if (this.mode !== 'live' || !secret) throw new AppException(503, ErrorCode.PAYMENT_FAILED, "Online payments aren't available right now.");
    const payment = await this.prisma.payment.findUnique({ where: { razorpayOrderId: input.razorpayOrderId }, select: { id: true } });
    if (!payment) throw notFound("We couldn't find that payment.");
    const ok = verifyPaymentSignature({ orderId: input.razorpayOrderId, paymentId: input.razorpayPaymentId, signature: input.signature, secret });
    // A bad signature is refused but never marks the payment failed (anyone could otherwise spam-fail a customer's payment).
    if (!ok) throw new AppException(400, ErrorCode.PAYMENT_FAILED, "We couldn't verify that payment. If money left your account it will be refunded automatically. Please try again or message us.");
    return this.markPaid({ razorpayOrderId: input.razorpayOrderId }, { razorpayPaymentId: input.razorpayPaymentId, signature: input.signature });
  }

  // ───────────── mock (dev only) ─────────────

  /** True only with no Razorpay keys outside production. The controller answers 404 otherwise. */
  get mockEnabled(): boolean {
    return this.mode === 'mock';
  }

  /** Simulates Razorpay's callback through the exact same `markPaid` path as verify/webhook. */
  async mockConfirm(paymentId: string, ok: boolean): Promise<PaymentResult> {
    if (!this.mockEnabled) throw notFound();
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment?.razorpayOrderId?.startsWith(MOCK_ORDER_PREFIX)) throw notFound("We couldn't find that payment.");
    if (ok) return this.markPaid({ paymentId }, { razorpayPaymentId: `pay_mock_${randomBytes(9).toString('base64url')}` });
    if (payment.status === 'PAID') throw conflict('That payment already went through.');
    await this.markFailed({ paymentId }, 'Test payment declined');
    throw new AppException(402, ErrorCode.PAYMENT_FAILED, PAYMENT_FAILED_MESSAGE);
  }

  // ───────────── the one place a payment becomes PAID ─────────────

  /**
   * Idempotent. The first caller flips PENDING/FAILED -> PAID and runs the domain handlers inside the same
   * transaction; any later call (webhook after verify, duplicate delivery) finds it PAID and does nothing.
   */
  async markPaid(where: { paymentId: string } | { razorpayOrderId: string }, info: { razorpayPaymentId: string; signature?: string; expectedAmountPaise?: number }): Promise<PaymentResult> {
    const key = 'paymentId' in where ? { id: where.paymentId } : { razorpayOrderId: where.razorpayOrderId };
    const outcome = await this.prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.findUnique({ where: key, include: { order: { select: { number: true } }, request: { select: { number: true } } } });
        if (!payment) throw notFound("We couldn't find that payment.");
        const result = (status: PaymentStatus, first: boolean): { result: PaymentResult; event?: PaidEvent } => ({
          result: {
            paymentId: payment.id,
            status,
            purpose: payment.purpose,
            orderNumber: payment.order?.number,
            customRequestNumber: payment.request?.number,
            alreadyProcessed: !first,
          },
        });
        if (payment.status === 'PAID' || payment.status === 'REFUNDED') return { ...result(payment.status, false) };
        if (info.expectedAmountPaise != null && info.expectedAmountPaise !== paise(payment.amount)) {
          throw new Error(`Amount mismatch on payment ${payment.id}: Razorpay says ${info.expectedAmountPaise} paise, expected ${paise(payment.amount)}`);
        }

        const claimed = await tx.payment.updateMany({
          where: { id: payment.id, status: { in: ['PENDING', 'FAILED'] } },
          data: { status: 'PAID', paidAt: new Date(), razorpayPaymentId: info.razorpayPaymentId, razorpaySignature: info.signature ?? null, failureReason: null },
        });
        if (claimed.count !== 1) return { ...result('PAID', false) };

        const event: PaidEvent = {
          paymentId: payment.id,
          purpose: payment.purpose,
          orderId: payment.orderId ?? undefined,
          customRequestId: payment.requestId ?? undefined,
          razorpayPaymentId: info.razorpayPaymentId,
        };
        const handlers = this.handlers.get(payment.purpose) ?? [];
        if (handlers.length === 0) this.logger.warn(`No paid handler registered for ${payment.purpose}; payment ${payment.id} marked PAID only`);
        for (const handler of handlers) await handler(event, tx);
        return { ...result('PAID', true), event };
      },
      { timeout: 15_000 },
    );

    if (outcome.event) {
      for (const listener of this.listeners.get(outcome.event.purpose) ?? []) {
        try {
          await listener(outcome.event);
        } catch (err) {
          this.logger.error(`Paid listener failed for ${outcome.event.paymentId}: ${(err as Error).message}`);
        }
      }
    }
    return outcome.result;
  }

  /** PENDING -> FAILED (a PAID payment is never downgraded). For ORDER payments also flags the order's paymentStatus. */
  async markFailed(where: { paymentId: string } | { razorpayOrderId: string }, reason: string): Promise<void> {
    const key = 'paymentId' in where ? { id: where.paymentId } : { razorpayOrderId: where.razorpayOrderId };
    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: key });
      if (!payment) return;
      const changed = await tx.payment.updateMany({ where: { id: payment.id, status: 'PENDING' }, data: { status: 'FAILED', failureReason: reason.slice(0, 500) } });
      if (changed.count === 1 && payment.orderId) {
        await tx.order.updateMany({ where: { id: payment.orderId, paymentStatus: 'PENDING' }, data: { paymentStatus: 'FAILED' } });
      }
    });
  }

  // ───────────── webhook ─────────────

  /**
   * `POST /payments/razorpay/webhook`. Verifies the HMAC of the RAW body, dedupes on the event id
   * (`X-Razorpay-Event-Id`, falling back to a hash of the body), and dispatches. A failure after the event was
   * recorded leaves it unprocessed and answers 500, so Razorpay's retry is processed again (all handlers are idempotent).
   */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined, eventIdHeader: string | undefined): Promise<{ status: 'processed' | 'duplicate' | 'ignored' }> {
    const secret = this.config.get('RAZORPAY_WEBHOOK_SECRET', { infer: true });
    if (!secret) throw new AppException(503, ErrorCode.BAD_REQUEST, 'Webhook is not configured.');
    if (!rawBody || !verifyWebhookSignature(rawBody, signature, secret)) throw new AppException(400, 'INVALID_SIGNATURE', 'Invalid signature.');

    let body: WebhookBody;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as WebhookBody;
    } catch {
      throw badRequest('Malformed webhook body.');
    }
    const eventId = eventIdHeader?.trim() || `sha256:${createHash('sha256').update(rawBody).digest('hex')}`;
    const type = body.event ?? 'unknown';

    try {
      await this.prisma.webhookEvent.create({ data: { provider: 'razorpay', eventId, type, payload: toJson(redactWebhookPayload(body)) } });
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
      const existing = await this.prisma.webhookEvent.findUnique({ where: { eventId } });
      if (existing?.processedAt) return { status: 'duplicate' };
      // Recorded earlier but not finished (crash or 500): process it now.
    }

    try {
      const handled = await this.dispatch(body);
      await this.prisma.webhookEvent.update({ where: { eventId }, data: { processedAt: new Date(), error: null } });
      return { status: handled ? 'processed' : 'ignored' };
    } catch (err) {
      await this.prisma.webhookEvent.update({ where: { eventId }, data: { error: (err as Error).message.slice(0, 500) } }).catch(() => undefined);
      this.logger.error(`Webhook ${type} (${eventId}) failed: ${(err as Error).message}`);
      throw err;
    }
  }

  private async dispatch(body: WebhookBody): Promise<boolean> {
    const payment = body.payload?.payment?.entity;
    switch (body.event) {
      case 'payment.captured':
      case 'order.paid': {
        const orderId = payment?.order_id ?? body.payload?.order?.entity?.id;
        if (!orderId || !payment?.id) return false;
        const exists = await this.prisma.payment.findUnique({ where: { razorpayOrderId: orderId }, select: { id: true } });
        if (!exists) return false; // not one of ours (another integration on the same account)
        if (payment.currency && payment.currency !== 'INR') throw new Error(`Unexpected currency ${payment.currency}`);
        await this.markPaid({ razorpayOrderId: orderId }, { razorpayPaymentId: payment.id, expectedAmountPaise: payment.amount });
        return true;
      }
      case 'payment.failed': {
        if (!payment?.order_id) return false;
        await this.markFailed({ razorpayOrderId: payment.order_id }, payment.error_description ?? payment.error_reason ?? 'Payment failed');
        return true;
      }
      case 'refund.created':
      case 'refund.processed': {
        const refund = body.payload?.refund?.entity;
        if (!refund?.payment_id || refund.amount == null) return false;
        await this.recordExternalRefund(refund.payment_id, refund.amount / 100);
        return true;
      }
      case 'refund.failed':
        this.logger.warn(`Razorpay reported a failed refund for payment ${body.payload?.refund?.entity?.payment_id ?? '?'}: process it manually`);
        return true;
      default:
        return false;
    }
  }

  /** A refund created outside this API (Razorpay dashboard): mirror it. Never lowers what we already recorded. */
  private async recordExternalRefund(razorpayPaymentId: string, rupees: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.findUnique({ where: { razorpayPaymentId } });
      if (!p || p.status === 'PENDING') return;
      const refundedAmount = Math.min(p.amount, Math.max(p.refundedAmount, Math.round(rupees)));
      const full = refundedAmount >= p.amount;
      await tx.payment.update({ where: { id: p.id }, data: { refundedAmount, ...(full ? { status: 'REFUNDED' as const } : {}) } });
      if (full && p.orderId) await this.markOrderRefundedIfUnpaid(tx, p.orderId);
    });
  }

  /** The order reads REFUNDED only when no captured payment is left on it (a duplicate-payment refund must not flip a paid order). */
  private async markOrderRefundedIfUnpaid(db: PrismaService | Prisma.TransactionClient, orderId: string): Promise<void> {
    const stillPaid = await db.payment.count({ where: { orderId, status: 'PAID' } });
    if (stillPaid === 0) await db.order.updateMany({ where: { id: orderId }, data: { paymentStatus: 'REFUNDED' } });
  }

  // ───────────── refunds ─────────────

  /**
   * Refund a captured payment (whole remaining amount by default). Real Razorpay refund when live; in mock
   * mode only the DB is updated. The refunded amount is claimed with a conditional update BEFORE the API call
   * (two concurrent refunds can't both go through) and released if the call fails.
   */
  async refundPayment(paymentId: string, opts: { amount?: number; reason: string }): Promise<{ refunded: number }> {
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!p) throw notFound("We couldn't find that payment.");
    if (p.status !== 'PAID') throw conflict("That payment hasn't been captured, so there is nothing to refund.");
    // Mock payments (dev) only exist in the DB. A real payment can only be refunded with live keys: without them we must
    // not pretend the money went back.
    const isMock = p.razorpayPaymentId?.startsWith('pay_mock_') ?? false;
    if (!isMock && this.mode !== 'live') throw new AppException(503, ErrorCode.PAYMENT_FAILED, "Refunds aren't available right now because payments aren't configured.");
    const remaining = p.amount - p.refundedAmount;
    const amount = opts.amount ?? remaining;
    if (!Number.isInteger(amount) || amount < 1 || amount > remaining) throw badRequest(`Refund must be between ₹1 and ₹${remaining}.`);
    const full = amount === remaining;

    const claimed = await this.prisma.payment.updateMany({
      where: { id: p.id, status: 'PAID', refundedAmount: p.refundedAmount },
      data: { refundedAmount: p.refundedAmount + amount, ...(full ? { status: 'REFUNDED' as const } : {}) },
    });
    if (claimed.count !== 1) throw conflict('That payment was just changed. Please refresh and try again.');

    try {
      if (!isMock && p.razorpayPaymentId) {
        await this.gateway!.refund(p.razorpayPaymentId, { amountPaise: paise(amount), notes: { reason: opts.reason.slice(0, 200) }, receipt: `rf-${p.id}`.slice(0, 40) });
      }
    } catch (err) {
      await this.prisma.payment.updateMany({ where: { id: p.id }, data: { refundedAmount: p.refundedAmount, status: 'PAID' } });
      this.logger.error(`Refund failed for payment ${p.id}: ${describeGatewayError(err)}`);
      throw new AppException(502, ErrorCode.PAYMENT_FAILED, "The refund couldn't be issued just now. We'll retry it manually.");
    }
    if (full && p.orderId) await this.markOrderRefundedIfUnpaid(this.prisma, p.orderId);
    return { refunded: amount };
  }

  /** Refund every captured payment of an order (cancellation / accepted return). Never throws; reports what failed. */
  async refundOrder(orderId: string, reason: string): Promise<{ refunded: number; failed: number }> {
    const paid = await this.prisma.payment.findMany({ where: { orderId, status: 'PAID' } });
    let refunded = 0;
    let failed = 0;
    for (const p of paid) {
      try {
        refunded += (await this.refundPayment(p.id, { reason })).refunded;
      } catch {
        failed += 1;
      }
    }
    return { refunded, failed };
  }
}
