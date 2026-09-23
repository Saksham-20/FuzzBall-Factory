import { http } from "@/lib/api/http";
import type { Review } from "@/lib/types";

export const listReviews = (productId: string) => http<Review[]>(`/products/${encodeURIComponent(productId)}/reviews`);

export async function canReview(productId: string): Promise<boolean> {
  return (await http<{ canReview: boolean }>(`/products/${encodeURIComponent(productId)}/can-review`)).canReview;
}

export const createReview = (input: { productId: string; rating: number; body: string }) => http<Review>("/reviews", { method: "POST", body: input });
