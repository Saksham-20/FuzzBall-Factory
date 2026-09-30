import type { Prisma } from '../generated/prisma/client.js';

/**
 * Recomputes `Product.ratingAverage/ratingCount` from PUBLISHED reviews, inside the caller's transaction. The product row
 * is locked first: two moderators publishing different reviews of one product at the same moment would otherwise each
 * aggregate a snapshot that misses the other's change, and the later write would silently drop one review from the
 * average. With the lock the second transaction waits, then aggregates after the first has committed.
 */
export async function recomputeProductRating(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Product" WHERE "id" = ${productId} FOR UPDATE`;
  const agg = await tx.review.aggregate({ where: { productId, status: 'PUBLISHED' }, _avg: { rating: true }, _count: { _all: true } });
  await tx.product.update({ where: { id: productId }, data: { ratingAverage: agg._avg.rating ?? 0, ratingCount: agg._count._all } });
}
