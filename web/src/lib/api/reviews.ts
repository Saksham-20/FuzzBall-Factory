import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/reviews";
import { ApiError, db, wait } from "@/lib/mock/db";
import type { Review } from "@/lib/types";

/** Only PUBLISHED reviews. Empty on purpose: never fabricate reviews. */
export async function listReviews(productId: string): Promise<Review[]> {
  if (!SITE.useMock) return real.listReviews(productId);
  await wait(150);
  return db.get().reviews.filter((r) => r.productId === productId && r.status === "PUBLISHED");
}

/** Verified buyers only: the customer must have a DELIVERED order containing the product. */
export async function canReview(productId: string): Promise<boolean> {
  if (!SITE.useMock) return real.canReview(productId);
  await wait(100);
  const d = db.get();
  if (!d.session) return false;
  return d.orders.some((o) => o.userId === d.session!.userId && o.status === "DELIVERED" && o.items.some((i) => i.productId === productId));
}

export async function createReview(input: { productId: string; rating: number; body: string }): Promise<Review> {
  if (!SITE.useMock) return real.createReview(input);
  await wait();
  const d = db.get();
  const u = d.session && d.users.find((x) => x.id === d.session!.userId);
  if (!u) throw new ApiError(401, "Log in to leave a review.");
  const review: Review = { id: `r${Date.now()}`, productId: input.productId, author: u.name.split(" ")[0], rating: input.rating, body: input.body, verified: true, status: "PENDING", createdAt: new Date().toISOString() };
  db.update((x) => ({ ...x, reviews: [...x.reviews, review] }));
  return review;
}
