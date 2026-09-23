import type { Review } from '../generated/prisma/client.js';

/** Wire shape: web `Review`. */
export interface ReviewDto {
  id: string;
  productId: string;
  author: string;
  rating: number;
  body: string;
  verified: boolean;
  status: 'PENDING' | 'PUBLISHED' | 'HIDDEN' | 'DISPUTED';
  createdAt: string;
  /** The maker's public reply, when one exists. */
  reply?: string;
  repliedAt?: string;
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
});
