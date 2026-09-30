import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { recomputeProductRating } from '../reviews/rating.js';
import { UploadsService } from '../uploads/uploads.service.js';

/** Days between "delete my account" and the erasure itself: time to change one's mind (and to finish open orders). */
export const ERASURE_GRACE_DAYS = 30;

const ORDER_DONE = ['DELIVERED', 'CANCELLED', 'REFUNDED'] as const;
const WORK_ORDER_DONE = ['DELIVERED', 'CLOSED', 'DECLINED', 'EXPIRED', 'CANCELLED'] as const;

export type ErasureOutcome = 'erased' | 'deferred' | 'skipped';

/**
 * DPDP Act erasure. Thirty days after a customer asks, their account is anonymised: the personal data goes, the money
 * trail stays. Orders, payments, quotes and refunds keep their amounts and dates (tax and disputes need them) but lose
 * names, phone numbers, emails, street addresses, gift notes and admin notes. Work-order conversations, photos,
 * saved addresses, wishlist, reviews, uploads and login history are deleted. The `User` row stays as an empty shell
 * (fake unusable email, no password) so foreign keys stay valid.
 *
 * It never erases while money or goods are still moving: an open order, an open work order or an unfinished refund
 * defers the erasure to a later run, and the customer's request stays on record. Staff accounts are never erased.
 */
@Injectable()
export class ErasureService {
  private readonly logger = new Logger(ErasureService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploads: UploadsService,
    private readonly notifications: NotificationsService,
  ) {}

  /** Scheduler entry: erases every account whose grace period is over. Returns how many were erased. */
  async processDue(now: Date = new Date(), limit = 20): Promise<number> {
    const cutoff = new Date(now.getTime() - ERASURE_GRACE_DAYS * 86_400_000);
    const due = await this.prisma.user.findMany({ where: { deletionRequestedAt: { lte: cutoff }, erasedAt: null, role: 'customer' }, select: { id: true }, take: limit, orderBy: { deletionRequestedAt: 'asc' } });
    let erased = 0;
    for (const { id } of due) {
      try {
        if ((await this.erase(id)) === 'erased') erased += 1;
      } catch (err) {
        this.logger.error(`Erasure of ${id} failed: ${(err as Error).message}`);
      }
    }
    return erased;
  }

  /** Why an account cannot be erased right now, or null when it can. */
  async blocker(userId: string): Promise<string | null> {
    const [orders, requests, refunds] = await Promise.all([
      this.prisma.order.count({ where: { userId, status: { notIn: [...ORDER_DONE] } } }),
      this.prisma.customRequest.count({ where: { userId, status: { notIn: [...WORK_ORDER_DONE] } } }),
      this.prisma.refundJob.count({ where: { status: { in: ['PENDING', 'PROCESSING'] }, payment: { OR: [{ order: { userId } }, { request: { userId } }] } } }),
    ]);
    if (orders > 0) return `${orders} open order(s)`;
    if (requests > 0) return `${requests} open work order(s)`;
    if (refunds > 0) return `${refunds} unfinished refund(s)`;
    return null;
  }

  async erase(userId: string): Promise<ErasureOutcome> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.erasedAt || user.role !== 'customer' || !user.deletionRequestedAt) return 'skipped';
    const blocked = await this.blocker(userId);
    if (blocked) {
      this.logger.warn(`Erasure of ${userId} deferred: ${blocked}`);
      return 'deferred';
    }

    // Files first: if storage is down we stop before touching the database, so nothing is half-erased.
    const files = await this.uploads.deleteAllFor(userId);
    if (files.failed > 0) {
      this.logger.warn(`Erasure of ${userId} deferred: ${files.failed} uploaded file(s) could not be deleted`);
      return 'deferred';
    }

    // Tell the person, at the address they are about to lose. (Outbox rows for that address are deleted below.)
    const oldEmail = user.email;
    await this.notifications.send('auth.account_erased', { to: oldEmail, name: user.name });

    const touchedProducts = await this.prisma.$transaction(async (tx) => {
      const products = await this.scrubReviews(tx, userId);
      await this.scrubOrders(tx, userId);
      await this.scrubWorkOrders(tx, userId);
      await Promise.all([
        tx.address.deleteMany({ where: { userId } }),
        tx.wishlistItem.deleteMany({ where: { userId } }),
        tx.refreshToken.deleteMany({ where: { userId } }),
        tx.passwordResetToken.deleteMany({ where: { userId } }),
        tx.emailToken.deleteMany({ where: { userId } }),
        tx.idempotencyKey.deleteMany({ where: { userId } }),
        tx.authThrottle.deleteMany({ where: { key: { in: [`login:${oldEmail}`, ...(user.phone ? [`login:${user.phone}`] : [])] } } }),
        tx.emailOutbox.deleteMany({ where: { toEmail: oldEmail } }),
        tx.auditLog.updateMany({ where: { actorId: userId }, data: { ip: null } }),
      ]);
      await tx.user.update({
        where: { id: userId },
        data: {
          name: 'Deleted customer',
          email: `erased-${userId}@erased.invalid`,
          phone: null,
          passwordHash: `erased:${randomBytes(24).toString('hex')}`, // not an argon2 hash: nothing verifies against it
          emailVerified: false,
          phoneVerified: false,
          tokenVersion: { increment: 1 },
          erasedAt: new Date(),
        },
      });
      await tx.auditLog.create({ data: { actorId: userId, action: 'account.erased', entity: 'User', entityId: userId, meta: { uploadsDeleted: files.removed } } });
      for (const productId of products) await recomputeProductRating(tx, productId);
      return products.length;
    });
    this.logger.log(`Account ${userId} erased (${touchedProducts} product rating(s) refreshed)`);
    return 'erased';
  }

  /** Deletes the customer's reviews (their words, published or not). Returns the products whose rating must be refreshed. */
  private async scrubReviews(tx: Prisma.TransactionClient, userId: string): Promise<string[]> {
    const reviews = await tx.review.findMany({ where: { userId }, select: { productId: true } });
    await tx.review.deleteMany({ where: { userId } });
    return [...new Set(reviews.map((r) => r.productId))];
  }

  private async scrubOrders(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const orders = await tx.order.findMany({ where: { userId }, select: { id: true } });
    for (const { id } of orders) {
      await tx.order.update({
        where: { id },
        data: {
          contact: { name: 'Deleted customer', email: '', phone: '' },
          contactEmail: `erased-${id}@erased.invalid`,
          contactPhone: '',
          // Country and state stay (shipping statistics, tax place of supply); everything that finds a person goes.
          address: { name: '', phone: '', line1: '', city: '', state: '', postalCode: '', country: '' },
          giftNote: null,
          notes: null,
          trackingUrl: null,
        },
      });
      await tx.orderEvent.updateMany({ where: { orderId: id }, data: { note: null, photo: null } });
    }
  }

  private async scrubWorkOrders(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    const requests = await tx.customRequest.findMany({ where: { userId }, select: { id: true } });
    const ids = requests.map((r) => r.id);
    if (ids.length === 0) return;
    await Promise.all([
      tx.customMessage.deleteMany({ where: { requestId: { in: ids } } }),
      tx.customRequestImage.deleteMany({ where: { requestId: { in: ids } } }),
      tx.customEvent.updateMany({ where: { requestId: { in: ids } }, data: { note: null, photo: null } }),
      tx.quote.updateMany({ where: { requestId: { in: ids } }, data: { counterNote: null } }),
      tx.customRequest.updateMany({
        where: { id: { in: ids } },
        data: { customerName: 'Deleted customer', customerPhone: '', title: 'Erased work order', description: '[erased]', personalization: null, occasion: null, notes: null, address: Prisma.DbNull, postalCode: '', courier: null, awb: null },
      }),
    ]);
  }
}
