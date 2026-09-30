import { Injectable } from '@nestjs/common';
import { notFound, unprocessable } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Most pieces one account can save. A shop has tens of products: this only stops a script filling the table. */
export const WISHLIST_MAX = 100;

export interface WishlistEntry {
  productId: string;
  addedAt: Date;
}

/**
 * Saved pieces, owner-scoped (every query is keyed by the caller's user id, never a client-supplied one). Adding is
 * idempotent, and the cap is checked under a per-user advisory lock so two quick taps cannot both slip past it.
 */
@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  /** Oldest first, so the web can show newest first by reversing. Saved pieces that were unpublished since are left out. */
  async list(userId: string): Promise<WishlistEntry[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId, product: { status: 'PUBLISHED' } },
      orderBy: { createdAt: 'asc' },
      select: { productId: true, createdAt: true },
    });
    return rows.map((r) => ({ productId: r.productId, addedAt: r.createdAt }));
  }

  async add(userId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { id: productId, status: 'PUBLISHED' }, select: { id: true } });
    if (!product) throw notFound("That piece isn't in the shop any more.");
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`wishlist:${userId}`}))`;
      const exists = await tx.wishlistItem.findUnique({ where: { userId_productId: { userId, productId } }, select: { id: true } });
      if (exists) return;
      if ((await tx.wishlistItem.count({ where: { userId } })) >= WISHLIST_MAX) {
        throw unprocessable(`You can save up to ${WISHLIST_MAX} pieces. Remove one to add another.`, 'WISHLIST_FULL');
      }
      await tx.wishlistItem.create({ data: { userId, productId } });
    });
  }

  async remove(userId: string, productId: string): Promise<void> {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
  }

  /** Folds a signed-out device's saved pieces into the account, then returns the full list. Never fails on a bad id. */
  async merge(userId: string, productIds: string[]): Promise<WishlistEntry[]> {
    const wanted = [...new Set(productIds)];
    if (wanted.length > 0) {
      const valid = await this.prisma.product.findMany({ where: { id: { in: wanted }, status: 'PUBLISHED' }, select: { id: true } });
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`wishlist:${userId}`}))`;
        const have = new Set((await tx.wishlistItem.findMany({ where: { userId }, select: { productId: true } })).map((r) => r.productId));
        let room = WISHLIST_MAX - have.size;
        for (const { id } of valid) {
          if (have.has(id)) continue;
          if (room <= 0) break;
          await tx.wishlistItem.create({ data: { userId, productId: id } });
          room -= 1;
        }
      });
    }
    return this.list(userId);
  }
}
