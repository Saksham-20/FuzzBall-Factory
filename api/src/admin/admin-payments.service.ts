import { Injectable } from '@nestjs/common';
import { badRequest, notFound } from '../common/errors.js';
import type { RefundStatus } from '../generated/prisma/enums.js';
import { PaymentsService } from '../payments/payments.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminCtx } from './admin-custom.service.js';
import { AuditService } from './audit.service.js';
import type { PaymentListQuery, RefundDto } from './dto/payment.dto.js';

export interface AdminPaymentDto {
  id: string;
  purpose: 'ORDER' | 'DEPOSIT' | 'BALANCE';
  method: 'RAZORPAY' | 'COD';
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'COD_DUE';
  amount: number;
  refundedAmount: number;
  /** Rupees still refundable right now (not already refunded or queued). */
  refundable: number;
  paidAt?: string;
  failureReason?: string;
  refunds: { id: string; amount: number; status: RefundStatus; reason: string; attempts: number; lastError?: string; createdAt: string }[];
}

/** Payments of one order or work order, with their refund jobs, and the manual refund (the safety net for FAILED jobs). */
@Injectable()
export class AdminPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly audit: AuditService,
  ) {}

  async list(q: PaymentListQuery): Promise<AdminPaymentDto[]> {
    if (!q.order && !q.request) throw badRequest('Say which order or work order: ?order=FB-1001 or ?request=WO-001.');
    const rows = await this.prisma.payment.findMany({
      where: { OR: [...(q.order ? [{ order: { number: q.order } }] : []), ...(q.request ? [{ request: { number: q.request } }] : [])] },
      include: { refunds: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((p) => ({
      id: p.id,
      purpose: p.purpose,
      method: p.method,
      status: p.status,
      amount: p.amount,
      refundedAmount: p.refundedAmount,
      refundable: p.status === 'PAID' ? Math.max(0, p.amount - p.refundReserved) : 0,
      paidAt: p.paidAt?.toISOString(),
      failureReason: p.failureReason ?? undefined,
      refunds: p.refunds.map((r) => ({ id: r.id, amount: r.amount, status: r.status, reason: r.reason, attempts: r.attempts, lastError: r.lastError ?? undefined, createdAt: r.createdAt.toISOString() })),
    }));
  }

  async refund(ctx: AdminCtx, paymentId: string, dto: RefundDto): Promise<{ refunded: number; pending: number }> {
    const exists = await this.prisma.payment.findUnique({ where: { id: paymentId }, select: { id: true, orderId: true, requestId: true } });
    if (!exists) throw notFound("We couldn't find that payment.");
    const result = await this.payments.refundPayment(paymentId, { amount: dto.amount, reason: `Admin: ${dto.reason}` });
    await this.audit.log({
      actorId: ctx.actorId,
      ip: ctx.ip,
      action: 'payment.refund',
      entity: 'Payment',
      entityId: paymentId,
      meta: { amount: dto.amount ?? null, reason: dto.reason, refunded: result.refunded, pending: result.pending, orderId: exists.orderId, requestId: exists.requestId },
    });
    return result;
  }
}
