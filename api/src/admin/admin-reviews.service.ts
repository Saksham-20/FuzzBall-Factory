import { Injectable } from '@nestjs/common';
import { notFound, validationFailed } from '../common/errors.js';
import type { Review } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminCtx } from './admin-custom.service.js';
import { AuditService } from './audit.service.js';

type ReviewStatus = 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'DISPUTED';

/** Wire shape: web `Review`. */
export interface ReviewDto {
  id: string;
  productId: string;
  author: string;
  rating: number;
  body: string;
  verified: boolean;
  status: ReviewStatus;
  createdAt: string;
  reply?: string;
  repliedAt?: string;
  /** Only set (and only meaningful) once the review has been disputed at least once. Never shown publicly. */
  disputeReason?: string;
}

export const toReviewDto = (r: Review): ReviewDto => ({
  id: r.id,
  productId: r.productId,
  author: r.author,
  rating: r.rating,
  body: r.body,
  verified: r.verified,
  status: r.status,
  createdAt: r.createdAt.toISOString(),
  ...(r.reply ? { reply: r.reply, repliedAt: r.repliedAt!.toISOString() } : {}),
  ...(r.disputeReason ? { disputeReason: r.disputeReason } : {}),
});

@Injectable()
export class AdminReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(status?: ReviewStatus): Promise<ReviewDto[]> {
    const rows = await this.prisma.review.findMany({ where: status ? { status } : {}, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 500 });
    return rows.map(toReviewDto);
  }

  /**
   * Publish / hide / send back to pending / dispute, then refresh the product's denormalised rating in the same
   * transaction. Moving to DISPUTED requires `disputeReason` (a false claim, a mismatched order, etc.); a disputed
   * review is never shown publicly (same visibility as HIDDEN) but is tracked distinctly, and the reason is kept
   * for the record even if the review is later published or hidden again.
   */
  async moderate(ctx: AdminCtx, id: string, status: ReviewStatus, disputeReason?: string): Promise<ReviewDto> {
    if (status === 'DISPUTED' && !disputeReason?.trim()) throw validationFailed({ disputeReason: 'Add a short reason for the dispute.' });
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.review.findUnique({ where: { id }, select: { id: true, status: true, productId: true } });
      if (!before) throw notFound('Review not found.');
      const row = await tx.review.update({ where: { id }, data: status === 'DISPUTED' ? { status, disputeReason: disputeReason!.trim() } : { status } });
      const agg = await tx.review.aggregate({ where: { productId: before.productId, status: 'PUBLISHED' }, _avg: { rating: true }, _count: { _all: true } });
      await tx.product.update({ where: { id: before.productId }, data: { ratingAverage: agg._avg.rating ?? 0, ratingCount: agg._count._all } });
      await this.audit.log(
        { actorId: ctx.actorId, action: 'review.moderate', entity: 'Review', entityId: id, meta: { from: before.status, to: status, ...(status === 'DISPUTED' ? { disputeReason: disputeReason!.trim() } : {}) }, ip: ctx.ip },
        tx,
      );
      return toReviewDto(row);
    });
  }

  /** Sets or replaces the maker's public reply. Shown under the review on the product page, labelled as the maker's reply. */
  async setReply(ctx: AdminCtx, id: string, reply: string): Promise<ReviewDto> {
    const body = reply.trim();
    if (!body) throw validationFailed({ reply: 'Write a reply before saving.' });
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.review.findUnique({ where: { id }, select: { id: true } });
      if (!before) throw notFound('Review not found.');
      const row = await tx.review.update({ where: { id }, data: { reply: body, repliedAt: new Date() } });
      await this.audit.log({ actorId: ctx.actorId, action: 'review.reply', entity: 'Review', entityId: id, meta: { reply: body }, ip: ctx.ip }, tx);
      return toReviewDto(row);
    });
  }

  /** Removes the maker's reply. */
  async clearReply(ctx: AdminCtx, id: string): Promise<ReviewDto> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.review.findUnique({ where: { id }, select: { id: true } });
      if (!before) throw notFound('Review not found.');
      const row = await tx.review.update({ where: { id }, data: { reply: null, repliedAt: null } });
      await this.audit.log({ actorId: ctx.actorId, action: 'review.reply_removed', entity: 'Review', entityId: id, ip: ctx.ip }, tx);
      return toReviewDto(row);
    });
  }
}
