import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/checkout-extra";
import { db, wait } from "@/lib/mock/db";
import type { Product } from "@/lib/types";

/**
 * Products for the lines in the basket, by id (published or not, so a piece that was
 * unpublished after being added can still be shown and removed).
 * The real API exposes this as GET /products?ids=…
 */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (!SITE.useMock) return real.getProductsByIds(ids);
  await wait(120);
  if (ids.length === 0) return [];
  return db.get().products.filter((p) => ids.includes(p.id));
}
