import { Inject, Injectable, Logger } from '@nestjs/common';
import { badRequest, conflict, notFound } from '../common/errors.js';
import { retryRead } from '../common/timeout.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { RefundStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RAZORPAY_GATEWAY, type RazorpayGateway } from './razorpay.gateway.js';

/** Pause after failed attempt N (1-based). Attempt 8 that fails is final. */
const BACKOFF_MINUTES = [1, 5, 15, 60, 180, 360, 720];
export const MAX_REFUND_ATTEMPTS = BACKOFF_MINUTES.length + 1;
/** A job stuck PROCESSING longer than this belonged to a process that died: pick it up again. */
const LEASE_MS = 5 * 60_000;
const paise = (rupees: number) => Math.round(rupees * 100);
const isMockPayment = (razorpayPaymentId: string | null) => razorpayPaymentId?.startsWith('pay_mock_') ?? false;

/** The order reads REFUNDED only when no captured payment is left on it (a duplicate-payment refund must not flip a paid order). */
export async function markOrderRefundedIfUnpaid(db: PrismaService | Prisma.TransactionClient, orderId: string): Promise<void> {
  const stillPaid = await db.payment.count({ where: { orderId, status: 'PAID' } });
  if (stillPaid === 0) await db.order.updateMany({ where: { id: orderId }, data: { paymentStatus: 'REFUNDED' } });
}

/** A 4xx from Razorpay (except rate limiting / timeouts) will not change on retry. */
export function isPermanentGatewayError(err: unknown): boolean {
  const status = (err as { statusCode?: number } | null)?.statusCode;
  return typeof status === 'number' && status >= 400 && status < 500 && status !== 429 && status !== 408;
}

const describe = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  const e = err as { statusCode?: number; error?: { code?: string; description?: string } } | null;
  if (e?.error?.description) return `${e.error.code ?? 'ERROR'}: ${e.error.description}${e.statusCode ? ` (HTTP ${e.statusCode})` : ''}`;
  return typeof err === 'string' ? err : 'unknown gateway error';
};

export interface RefundOutcome {
  jobId: string;
  status: RefundStatus;
  amount: number;
  lastError?: string;
}

/**
 * Durable refunds. A refund is first written down as a `RefundJob` (reserving its rupees on the payment so two refunds
 * can never overshoot), then sent to Razorpay right away; if that fails for a reason a retry can fix, the scheduler
 * retries it with backoff. Every Razorpay refund carries `receipt = rf-<jobId>`: before any retry we look the payment's
 * refunds up and adopt a matching one, so a call that timed out (outcome unknown) is never sent twice.
 */
@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(RAZORPAY_GATEWAY) private readonly gateway: RazorpayGateway | null,
  ) {}

  /** Validates, reserves the rupees and queues the job. Does not call Razorpay (see `refund`). */
  async request(paymentId: string, opts: { amount?: number; reason: string }): Promise<{ jobId: string; amount: number }> {
    const p = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!p) throw notFound("We couldn't find that payment.");
    if (p.status !== 'PAID') throw conflict("That payment hasn't been captured, so there is nothing to refund.");
    const remaining = p.amount - p.refundReserved;
    const amount = opts.amount ?? remaining;
    if (!Number.isInteger(amount) || amount < 1 || amount > remaining) throw badRequest(remaining < 1 ? 'That payment is already fully refunded.' : `Refund must be between ₹1 and ₹${remaining}.`);

    const job = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({ where: { id: p.id, status: 'PAID', refundReserved: p.refundReserved }, data: { refundReserved: { increment: amount } } });
      if (claimed.count !== 1) throw conflict('That payment was just changed. Please refresh and try again.');
      return tx.refundJob.create({ data: { paymentId: p.id, amount, reason: opts.reason.slice(0, 200) } });
    });
    return { jobId: job.id, amount };
  }

  /** Queue a refund and try it once right now. Never throws for a Razorpay problem: the outcome says what happened. */
  async refund(paymentId: string, opts: { amount?: number; reason: string }): Promise<RefundOutcome> {
    const { jobId } = await this.request(paymentId, opts);
    return this.process(jobId);
  }

  /** Runs one job if it is due (or its lease expired). Safe to call concurrently: only one caller wins the claim. */
  async process(jobId: string): Promise<RefundOutcome> {
    const now = new Date();
    const claimed = await this.prisma.refundJob.updateMany({
      where: {
        id: jobId,
        OR: [
          { status: 'PENDING', nextAttemptAt: { lte: new Date(now.getTime() + 1000) } },
          { status: 'PROCESSING', updatedAt: { lt: new Date(now.getTime() - LEASE_MS) } },
        ],
      },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    });
    const job = await this.prisma.refundJob.findUnique({ where: { id: jobId }, include: { payment: true } });
    if (!job) throw notFound('Refund not found.');
    const outcome = (): RefundOutcome => ({ jobId: job.id, status: job.status, amount: job.amount, lastError: job.lastError ?? undefined });
    if (claimed.count !== 1) return outcome(); // done, failed, backing off, or another worker has it

    try {
      let refundId: string | null = null;
      if (!isMockPayment(job.payment.razorpayPaymentId)) {
        if (!this.gateway || !job.payment.razorpayPaymentId) throw new Error('Razorpay is not configured, so this refund cannot be sent yet');
        // Reconcile first: an earlier attempt may have reached Razorpay even though we never heard back.
        if (job.attempts > 1) {
          const existing = await retryRead(() => this.gateway!.listRefunds(job.payment.razorpayPaymentId!));
          refundId = existing.find((r) => r.receipt === this.receipt(job.id))?.id ?? null;
          if (refundId) this.logger.warn(`Refund job ${job.id}: an earlier attempt already went through at Razorpay (${refundId}); adopting it`);
        }
        refundId ??= (
          await this.gateway.refund(job.payment.razorpayPaymentId, { amountPaise: paise(job.amount), notes: { reason: job.reason }, receipt: this.receipt(job.id) })
        ).id;
      }
      await this.complete(job.id, refundId);
      return { jobId: job.id, status: 'DONE', amount: job.amount };
    } catch (err) {
      return this.failed(job, err);
    }
  }

  /** Cron entry: every refund that is due, oldest first. */
  async processDue(limit = 20): Promise<{ processed: number; done: number }> {
    const now = new Date();
    const due = await this.prisma.refundJob.findMany({
      where: { OR: [{ status: 'PENDING', nextAttemptAt: { lte: now } }, { status: 'PROCESSING', updatedAt: { lt: new Date(now.getTime() - LEASE_MS) } }] },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    let done = 0;
    for (const { id } of due) {
      const out = await this.process(id).catch((e: Error) => {
        this.logger.error(`Refund job ${id} crashed: ${e.message}`);
        return null;
      });
      if (out?.status === 'DONE') done += 1;
    }
    return { processed: due.length, done };
  }

  private receipt(jobId: string) {
    return `rf-${jobId}`.slice(0, 40);
  }

  private async complete(jobId: string, razorpayRefundId: string | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.refundJob.updateMany({ where: { id: jobId, status: 'PROCESSING' }, data: { status: 'DONE', razorpayRefundId, doneAt: new Date(), lastError: null } });
      if (claimed.count !== 1) return;
      const job = await tx.refundJob.findUniqueOrThrow({ where: { id: jobId } });
      const payment = await tx.payment.update({ where: { id: job.paymentId }, data: { refundedAmount: { increment: job.amount } } });
      const full = payment.refundedAmount >= payment.amount;
      if (full) await tx.payment.update({ where: { id: payment.id }, data: { status: 'REFUNDED' } });
      if (full && payment.orderId) await markOrderRefundedIfUnpaid(tx, payment.orderId);
    });
  }

  private async failed(job: { id: string; paymentId: string; amount: number; attempts: number }, err: unknown): Promise<RefundOutcome> {
    const message = describe(err).slice(0, 500);
    const final = isPermanentGatewayError(err) || job.attempts >= MAX_REFUND_ATTEMPTS;
    if (final) {
      await this.prisma.$transaction([
        this.prisma.refundJob.update({ where: { id: job.id }, data: { status: 'FAILED', lastError: message } }),
        // Give the rupees back to the payment so a person can refund it by hand from the admin.
        this.prisma.payment.update({ where: { id: job.paymentId }, data: { refundReserved: { decrement: job.amount } } }),
      ]);
      this.logger.error(`[REFUND FAILED] job ${job.id} (payment ${job.paymentId}, ₹${job.amount}) gave up after ${job.attempts} attempt(s): ${message}. Refund it by hand.`);
      return { jobId: job.id, status: 'FAILED', amount: job.amount, lastError: message };
    }
    const minutes = BACKOFF_MINUTES[Math.min(job.attempts, BACKOFF_MINUTES.length) - 1];
    await this.prisma.refundJob.update({ where: { id: job.id }, data: { status: 'PENDING', lastError: message, nextAttemptAt: new Date(Date.now() + minutes * 60_000) } });
    this.logger.warn(`Refund job ${job.id} attempt ${job.attempts} failed (${message}); retrying in ${minutes} min`);
    return { jobId: job.id, status: 'PENDING', amount: job.amount, lastError: message };
  }
}
