import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { OrderStatus, PaymentStatus, Role } from '../generated/prisma/enums.js';
import { conflict, invalidTransition, notFound, validationFailed } from '../common/errors.js';
import { PaymentsService } from '../payments/payments.service.js';
import type { PaidEvent } from '../payments/payments.types.js';
import { OrderNotifier } from './order-notifier.service.js';
import { toOrderDto, ORDER_INCLUDE, type OrderDto, type OrderRow } from './order.mapper.js';
import { ORDER_NEXT } from './order-transitions.js';

/** Who caused a transition. `RequestUser` (`{ userId, role }`) is assignable; use `SYSTEM_ACTOR` for jobs/webhooks. */
export interface OrderActor {
  userId: string | null;
  role: Role | 'system';
}
export const SYSTEM_ACTOR: OrderActor = { userId: null, role: 'system' };

export interface TransitionOptions {
  /** Timeline note (shown to the customer). */
  note?: string;
  /** Required (here or already stored) when moving to SHIPPED. */
  courier?: string;
  awb?: string;
  /** Optional photo URL for the timeline entry. */
  photo?: string;
  /** Skip the customer email (system clean-ups the customer never saw). */
  silent?: boolean;
}

interface TransitionOutcome {
  from: OrderStatus;
  eventId: string;
  /** Razorpay money to hand back after commit. */
  refund: boolean;
}

/**
 * THE state machine for orders (docs/API.md rule 7). Every status change goes through `transition`, which in
 * one Prisma transaction (a) checks `ORDER_NEXT`, (b) updates the row with a compare-and-set on the current
 * status, (c) applies the side effects that must be atomic with it (restock and coupon release on cancel,
 * payment status, courier/AWB) and (d) writes the OrderEvent. Emails and refunds happen after commit.
 *
 * Admin controllers call `transition(number, to, actor, { note, courier, awb })`; nothing else sets `Order.status`
 * (the payment-captured edge is `applyPayment`, registered as the ORDER paid handler).
 */
@Injectable()
export class OrderStateService implements OnModuleInit {
  private readonly logger = new Logger(OrderStateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly notifier: OrderNotifier,
  ) {}

  onModuleInit() {
    this.payments.registerPaidHandler('ORDER', (event, tx) => this.applyPayment(tx, event));
    this.payments.registerPaidListener('ORDER', (event) => this.afterPayment(event));
  }

  /** Public entry point. Returns the updated order in the web `Order` shape. */
  async transition(number: string, to: OrderStatus, actor: OrderActor, opts: TransitionOptions = {}): Promise<OrderDto> {
    const found = await this.prisma.order.findUnique({ where: { number }, select: { id: true } });
    if (!found) throw notFound('Order not found.');

    const outcome = await this.prisma.$transaction((tx) => this.transitionInTx(tx, found.id, to, actor, opts), { timeout: 15_000 });

    if (outcome.refund) await this.refundAfterCommit(found.id, to, outcome.eventId);

    const fresh = await this.prisma.order.findUniqueOrThrow({ where: { id: found.id }, include: ORDER_INCLUDE });
    if (!opts.silent) await this.notifier.transitioned(fresh, to, opts.note);
    return toOrderDto(fresh);
  }

  private async transitionInTx(tx: Prisma.TransactionClient, id: string, to: OrderStatus, actor: OrderActor, opts: TransitionOptions): Promise<TransitionOutcome> {
    const o = await tx.order.findUnique({ where: { id }, include: { items: true } });
    if (!o) throw notFound('Order not found.');
    if (!ORDER_NEXT[o.status].includes(to)) throw invalidTransition(o.status, to);

    const courier = opts.courier?.trim() || o.courier || undefined;
    const awb = opts.awb?.trim() || o.awb || undefined;
    if (to === 'SHIPPED' && (!courier || !awb)) {
      throw validationFailed({ ...(courier ? {} : { courier: 'Required' }), ...(awb ? {} : { awb: 'Required' }) }, 'Add the courier and AWB number to ship.');
    }

    let paymentStatus: PaymentStatus | undefined;
    let refund = false;
    if (to === 'CANCELLED') {
      if (o.paymentStatus === 'PAID') refund = o.paymentMethod === 'RAZORPAY'; // flips to REFUNDED once the refund is issued
      else if (o.paymentStatus === 'COD_DUE' || o.paymentStatus === 'PENDING') paymentStatus = 'FAILED';
    } else if (to === 'REFUNDED') {
      paymentStatus = 'REFUNDED';
      refund = o.paymentMethod === 'RAZORPAY' && o.paymentStatus === 'PAID';
    } else if (to === 'DELIVERED' && o.paymentMethod === 'COD' && o.paymentStatus === 'COD_DUE') {
      paymentStatus = 'PAID'; // cash collected by the courier
    }

    const claimed = await tx.order.updateMany({
      where: { id, status: o.status },
      data: {
        status: to,
        ...(courier ? { courier } : {}),
        ...(awb ? { awb } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        ...(to === 'CANCELLED' && opts.note ? { cancelReason: opts.note.slice(0, 500) } : {}),
      },
    });
    if (claimed.count !== 1) throw conflict('That order was just updated by someone else. Please refresh and try again.');

    if (to === 'CANCELLED') await this.releaseReservations(tx, o.id, o.items);

    const note = opts.note ?? (to === 'SHIPPED' ? `Handed to ${courier}. AWB ${awb}.` : undefined);
    const event = await tx.orderEvent.create({ data: { orderId: id, status: to, note, photo: opts.photo, actorId: actor.userId } });
    return { from: o.status, eventId: event.id, refund };
  }

  /** Cancellation gives back the stock and the coupon use that placing the order took. Runs once (compare-and-set above). */
  private async releaseReservations(tx: Prisma.TransactionClient, orderId: string, items: { variantId: string | null; qty: number }[]) {
    const byVariant = new Map<string, number>();
    for (const i of items) if (i.variantId) byVariant.set(i.variantId, (byVariant.get(i.variantId) ?? 0) + i.qty);
    for (const [variantId, qty] of [...byVariant].sort(([a], [b]) => a.localeCompare(b))) {
      await tx.productVariant.updateMany({ where: { id: variantId }, data: { stock: { increment: qty } } });
    }
    const redemptions = await tx.couponRedemption.findMany({ where: { orderId } });
    for (const r of redemptions) {
      await tx.coupon.updateMany({ where: { id: r.couponId, uses: { gt: 0 } }, data: { uses: { decrement: 1 } } });
    }
    if (redemptions.length) await tx.couponRedemption.deleteMany({ where: { orderId } });
  }

  private async refundAfterCommit(orderId: string, to: OrderStatus, eventId: string) {
    const result = await this.payments.refundOrder(orderId, to === 'CANCELLED' ? 'Order cancelled' : 'Order returned');
    const suffix =
      result.failed > 0
        ? " We couldn't send the refund automatically; we'll process it by hand and let you know."
        : result.refunded > 0
          ? ` Refund of ₹${result.refunded} is on its way to your original payment method (usually 5-7 business days).`
          : '';
    if (!suffix) return;
    const ev = await this.prisma.orderEvent.findUnique({ where: { id: eventId }, select: { note: true } });
    await this.prisma.orderEvent.update({ where: { id: eventId }, data: { note: `${ev?.note ?? ''}${suffix}`.trim() } });
    if (result.failed > 0) this.logger.error(`Order ${orderId}: automatic refund failed, needs a manual refund`);
  }

  // ───────────── the payment-captured edge ─────────────

  /**
   * ORDER paid handler: runs inside the payment transaction. PENDING_PAYMENT -> CONFIRMED (+ paymentStatus PAID),
   * with PLACED and CONFIRMED timeline entries (same as the web mock). Idempotent; an order that is not pending
   * (already paid, or cancelled while the customer was paying) keeps its status and gets a note for the maker.
   */
  async applyPayment(tx: Prisma.TransactionClient, event: PaidEvent): Promise<void> {
    if (!event.orderId) return;
    const o = await tx.order.findUnique({ where: { id: event.orderId }, select: { id: true, status: true, paymentStatus: true } });
    if (!o) return;
    if (o.status === 'PENDING_PAYMENT') {
      const claimed = await tx.order.updateMany({ where: { id: o.id, status: 'PENDING_PAYMENT' }, data: { status: 'CONFIRMED', paymentStatus: 'PAID' } });
      if (claimed.count === 1) {
        const at = new Date();
        await tx.orderEvent.createMany({
          data: [
            { orderId: o.id, status: 'PLACED', at },
            { orderId: o.id, status: 'CONFIRMED', note: 'Payment received.', at: new Date(at.getTime() + 1) },
          ],
        });
        return;
      }
    }
    // Not pending any more: money arrived for an order that can't use it. `afterPayment` refunds it.
    const reason = o.status === 'CANCELLED' ? 'Payment arrived after this order was cancelled.' : 'A second payment arrived for this order.';
    await tx.order.updateMany({ where: { id: o.id, paymentStatus: { not: 'PAID' } }, data: { paymentStatus: 'PAID' } });
    await tx.orderEvent.create({ data: { orderId: o.id, status: o.status, note: `${reason} It will be refunded.` } });
  }

  /** Post-commit: email for a normal confirmation; automatic refund for late or duplicate payments. */
  async afterPayment(event: PaidEvent): Promise<void> {
    if (!event.orderId) return;
    const order = await this.prisma.order.findUnique({ where: { id: event.orderId }, include: ORDER_INCLUDE });
    if (!order) return;
    const paid = await this.prisma.payment.findMany({ where: { orderId: order.id, status: 'PAID' }, orderBy: [{ paidAt: 'asc' }, { id: 'asc' }], select: { id: true } });
    const unusable = order.status === 'CANCELLED' || (paid.length > 0 && paid[0].id !== event.paymentId);
    if (unusable) {
      try {
        const { refunded } = await this.payments.refundPayment(event.paymentId, { reason: order.status === 'CANCELLED' ? 'Paid after cancellation' : 'Duplicate payment' });
        await this.prisma.orderEvent.create({ data: { orderId: order.id, status: order.status, note: `Refunded ₹${refunded} automatically.` } });
      } catch (err) {
        this.logger.error(`Order ${order.number}: could not auto-refund payment ${event.paymentId}: ${(err as Error).message}`);
      }
      return;
    }
    if (order.status === 'CONFIRMED') await this.notifier.transitioned(order, 'CONFIRMED');
  }
}

export type { OrderRow };
