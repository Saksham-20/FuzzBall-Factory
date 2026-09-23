import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { conflict, forbidden, notFound } from '../common/errors.js';
import { toReviewDto, type ReviewDto } from './review.mapper.js';
import type { CreateReviewDto } from './dto/reviews.dto.js';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Only PUBLISHED reviews, newest first. Empty on purpose when there are none: never fabricate reviews. */
  async listPublished(productId: string): Promise<ReviewDto[]> {
    const rows = await this.prisma.review.findMany({ where: { productId, status: 'PUBLISHED' }, orderBy: { createdAt: 'desc' } });
    return rows.map(toReviewDto);
  }

  /** The customer's DELIVERED order that contains this product (their proof of purchase), if any. */
  private deliveredOrderFor(db: Db, userId: string, productId: string) {
    return db.order.findFirst({
      where: { userId, status: 'DELIVERED', items: { some: { productId } } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
  }

  /** True for a signed-in customer with a delivered order containing the product who hasn't reviewed it yet. */
  async canReview(productId: string, userId: string | undefined): Promise<boolean> {
    if (!userId) return false;
    const [order, existing] = await Promise.all([
      this.deliveredOrderFor(this.prisma, userId, productId),
      this.prisma.review.findUnique({ where: { userId_productId: { userId, productId } }, select: { id: true } }),
    ]);
    return !!order && !existing;
  }

  /** Verified buyers only. Created PENDING: it goes live when the maker approves it in the admin. */
  async create(userId: string, dto: CreateReviewDto): Promise<ReviewDto> {
    const [user, product] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
      this.prisma.product.findUnique({ where: { id: dto.productId }, select: { id: true } }),
    ]);
    if (!user) throw notFound('Account not found.');
    if (!product) throw notFound("We couldn't find that piece.");
    const order = await this.deliveredOrderFor(this.prisma, userId, product.id);
    if (!order) throw forbidden("Only customers who've received this piece can review it.");
    if (await this.prisma.review.findUnique({ where: { userId_productId: { userId, productId: product.id } }, select: { id: true } })) {
      throw conflict("You've already reviewed this piece.");
    }
    const row = await this.prisma.review.create({
      data: { productId: product.id, userId, orderId: order.id, author: user.name.trim().split(/\s+/)[0] || 'Customer', rating: dto.rating, body: dto.body, verified: true, status: 'PENDING' },
    });
    return toReviewDto(row);
  }

  /**
   * Recompute `Product.ratingAverage/ratingCount` from PUBLISHED reviews. The admin moderation code calls this
   * after it publishes, hides or deletes a review (the denormalised columns feed `Product.rating`).
   */
  async recomputeRating(productId: string, db: Db = this.prisma): Promise<void> {
    const agg = await db.review.aggregate({ where: { productId, status: 'PUBLISHED' }, _avg: { rating: true }, _count: { _all: true } });
    await db.product.update({ where: { id: productId }, data: { ratingAverage: agg._avg.rating ?? 0, ratingCount: agg._count._all } });
  }
}
