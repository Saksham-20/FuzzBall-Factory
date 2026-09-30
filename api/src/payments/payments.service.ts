import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { PaymentStatus } from '../generated/prisma/enums.js';
import { AppException, badRequest, conflict, ErrorCode, notFound } from '../common/errors.js';
import type { CheckoutPayment, CreatePaymentInput, PaidEvent, PaidHandler, PaidListener, PaymentPurpose, PaymentsPort } from './payments.types.js';
import { reportError } from '../common/error-reporter.js';
import { RAZORPAY_GATEWAY, type RazorpayGateway } from './razorpay.gateway.js';
import { verifyPaymentSignature, verifyWebhookSignature } from './razorpay-signature.util.js';
import { markOrderRefundedIfUnpaid, RefundsService } from './refunds.service.js';

/** 'live' = real Razorpay keys; 'mock' = PAYMENTS_MODE=mock ("test payment", never production money); 'disabled' = Razorpay unusable. */
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

interface WebhookBody {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; error_description?: string; error_reason?: string } };
    order?: { entity?: { id?: string } };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number; status?: string; receipt?: string | null } };
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
/** Razorpay captured a different amount than we asked for. Never marks the payment paid; needs a human. */
export class AmountMismatchError extends Error {
  constructor(paymentId: string, gotPaise: number, expectedPaise: number) {
    super(`Amount mismatch on payment ${paymentId}: Razorpay says ${gotPaise} paise, expected ${expectedPaise}`);
    this.name = 'AmountMismatchError';
  }
}

@Injectable()
export class PaymentsService implements PaymentsPort {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly handlers = new Map<PaymentPurpose, PaidHandler[]>();
  private readonly listeners = new Map<PaymentPurpose, PaidListener[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    @Inject(RAZORPAY_GATEWAY) private readonly gateway: RazorpayGateway | null,
    private readonly refunds: RefundsService,
  ) {}

  // ───────────── mode ─────────────

  get mode(): PaymentMode {
    // PAYMENTS_MODE=mock never touches Razorpay, even if keys are set; env validation makes this choice explicit.
    if (this.config.get('PAYMENTS_MODE', { infer: true }) === 'mock') return 'mock';
    if (this.gateway && this.keySecret) return 'live';
    // Razorpay was chosen but can't be used (validation makes this unreachable at boot): refuse rather than fake it.
    return 'disabled';
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

    // A customer who taps "pay" again (closed the window, retried after a failure) resumes the SAME Razorpay order instead of
    // stacking up new ones: one Razorpay order can only be captured once, so a duplicate charge is impossible on this path.
    const open = await this.findOpenPayment(input, mode);
    if (open) return open;

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

  /** An unpaid (pending or failed) payment for the same owner, purpose and amount, in the current mode. */
  private async findOpenPayment(input: CreatePaymentInput, mode: PaymentMode): Promise<CheckoutPayment | null> {
    const row = await this.prisma.payment.findFirst({
      where: {
        purpose: input.purpose,
        status: { in: ['PENDING', 'FAILED'] },
        amount: input.amount,
        razorpayOrderId: { not: null },
        ...(input.purpose === 'ORDER' ? { orderId: input.orderId } : { requestId: input.customRequestId }),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!row?.razorpayOrderId) return null;
    const isMock = row.razorpayOrderId.startsWith(MOCK_ORDER_PREFIX);
    if (isMock !== (mode === 'mock')) return null; // the mode changed since it was created
    // Razorpay lets the customer retry on the same order after a failed attempt: a new attempt starts from PENDING again.
    if (row.status === 'FAILED') await this.prisma.payment.updateMany({ where: { id: row.id, status: 'FAILED' }, data: { status: 'PENDING', failureReason: null } });
    return { paymentId: row.id, razorpayOrderId: row.razorpayOrderId, keyId: mode === 'live' ? (this.keyId as string) : MOCK_KEY_ID, amountPaise: paise(row.amount), currency: 'INR', mock: mode === 'mock' };
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

  /** True only when PAYMENTS_MODE resolves to mock. The controller answers 404 otherwise. */
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
          throw new AmountMismatchError(payment.id, info.expectedAmountPaise, paise(payment.amount));
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
          reportError(err, { area: 'payments', extra: { paymentId: outcome.event.paymentId, purpose: outcome.event.purpose } });
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
      const { handled, note } = await this.dispatch(body);
      // `note` keeps a problem that a retry cannot fix (amount mismatch) visible on the event while still answering 200.
      await this.prisma.webhookEvent.update({ where: { eventId }, data: { processedAt: new Date(), error: note ?? null } });
      return { status: handled ? 'processed' : 'ignored' };
    } catch (err) {
      await this.prisma.webhookEvent.update({ where: { eventId }, data: { error: (err as Error).message.slice(0, 500) } }).catch(() => undefined);
      this.logger.error(`Webhook ${type} (${eventId}) failed: ${(err as Error).message}`);
      reportError(err, { area: 'payments', extra: { webhookType: type, eventId } });
      throw err;
    }
  }

  private async dispatch(body: WebhookBody): Promise<{ handled: boolean; note?: string }> {
    const payment = body.payload?.payment?.entity;
    switch (body.event) {
      case 'payment.captured':
      case 'order.paid': {
        const orderId = payment?.order_id ?? body.payload?.order?.entity?.id;
        if (!orderId || !payment?.id) return { handled: false };
        const exists = await this.prisma.payment.findUnique({ where: { razorpayOrderId: orderId }, select: { id: true } });
        if (!exists) return { handled: false }; // not one of ours (another integration on the same account)
        if (payment.currency && payment.currency !== 'INR') throw new Error(`Unexpected currency ${payment.currency}`);
        try {
          await this.markPaid({ razorpayOrderId: orderId }, { razorpayPaymentId: payment.id, expectedAmountPaise: payment.amount });
        } catch (err) {
          if (!(err instanceof AmountMismatchError)) throw err;
          // Retrying cannot fix a wrong amount (Razorpay would re-send for 24h): answer 200, keep the payment pending
          // with the reason on it, and shout so someone reconciles it by hand in the Razorpay dashboard.
          await this.prisma.payment.updateMany({ where: { id: exists.id, status: 'PENDING' }, data: { failureReason: err.message.slice(0, 500) } });
          this.logger.error(`[NEEDS REVIEW] ${err.message} (Razorpay payment ${payment.id})`);
          reportError(err, { area: 'payments', extra: { paymentId: exists.id, razorpayPaymentId: payment.id } });
          return { handled: true, note: err.message.slice(0, 500) };
        }
        return { handled: true };
      }
      case 'payment.failed': {
        if (!payment?.order_id) return { handled: false };
        await this.markFailed({ razorpayOrderId: payment.order_id }, payment.error_description ?? payment.error_reason ?? 'Payment failed');
        return { handled: true };
      }
      case 'refund.created':
      case 'refund.processed': {
        const refund = body.payload?.refund?.entity;
        if (!refund?.payment_id || refund.amount == null) return { handled: false };
        // Our own refunds (receipt rf-<jobId>) are booked by RefundsService when the job completes; counting them here too would double them.
        if (refund.receipt?.startsWith('rf-')) return { handled: true };
        await this.recordExternalRefund(refund.payment_id, refund.amount / 100);
        return { handled: true };
      }
      case 'refund.failed':
        this.logger.warn(`Razorpay reported a failed refund for payment ${body.payload?.refund?.entity?.payment_id ?? '?'}: process it manually`);
        reportError(new Error('Razorpay reported a failed refund'), { area: 'refunds', extra: { razorpayPaymentId: body.payload?.refund?.entity?.payment_id } });
        return { handled: true };
      default:
        return { handled: false };
    }
  }

  /** A refund created outside this API (Razorpay dashboard): mirror it. Never lowers what we already recorded. */
  private async recordExternalRefund(razorpayPaymentId: string, rupees: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const p = await tx.payment.findUnique({ where: { razorpayPaymentId } });
      if (!p || p.status === 'PENDING') return;
      const refundedAmount = Math.min(p.amount, Math.max(p.refundedAmount, Math.round(rupees)));
      const full = refundedAmount >= p.amount;
      await tx.payment.update({ where: { id: p.id }, data: { refundedAmount, refundReserved: Math.max(p.refundReserved, refundedAmount), ...(full ? { status: 'REFUNDED' as const } : {}) } });
      if (full && p.orderId) await markOrderRefundedIfUnpaid(tx, p.orderId);
    });
  }

  // ───────────── refunds ─────────────

  /**
   * Refund a captured payment (whole remaining amount by default). The refund is written down first (RefundsService:
   * rupees reserved so two refunds can't overshoot), then sent to Razorpay right away. If Razorpay is down or slow the job
   * stays PENDING and the scheduler retries it, reconciling first so a call that timed out is never sent twice.
   * `refunded` = rupees Razorpay has confirmed; `pending` = rupees queued for retry. Mock payments only touch the DB.
   * Throws only when the refund can't even be attempted (not captured, over the remaining amount, payments not configured)
   * or Razorpay refuses it for good (a person must then refund it by hand).
   */
  async refundPayment(paymentId: string, opts: { amount?: number; reason: string }): Promise<{ refunded: number; pending: number }> {
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId }, select: { razorpayPaymentId: true } });
    if (!p) throw notFound("We couldn't find that payment.");
    // A real payment can only be refunded with live keys: without them we must not pretend the money went back.
    const isMock = p.razorpayPaymentId?.startsWith('pay_mock_') ?? false;
    if (!isMock && this.mode !== 'live') throw new AppException(503, ErrorCode.PAYMENT_FAILED, "Refunds aren't available right now because payments aren't configured.");
    const out = await this.refunds.refund(paymentId, opts);
    if (out.status === 'FAILED') throw new AppException(502, ErrorCode.PAYMENT_FAILED, "The refund couldn't be issued just now. We'll refund it by hand.");
    return out.status === 'DONE' ? { refunded: out.amount, pending: 0 } : { refunded: 0, pending: out.amount };
  }

  /** Refund every captured payment of an order (cancellation / accepted return). Never throws; reports what happened. */
  async refundOrder(orderId: string, reason: string): Promise<{ refunded: number; pending: number; failed: number }> {
    const paid = await this.prisma.payment.findMany({ where: { orderId, status: 'PAID' } });
    let refunded = 0;
    let pending = 0;
    let failed = 0;
    for (const p of paid) {
      try {
        const r = await this.refundPayment(p.id, { reason });
        refunded += r.refunded;
        pending += r.pending;
      } catch {
        failed += 1;
      }
    }
    return { refunded, pending, failed };
  }
}
