import { http } from "@/lib/api/http";
import { rememberProducts } from "@/lib/state/productCache";
import type { Product } from "@/lib/types";

/** Published and archived pieces (never drafts), max 50 ids per call. */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const out: Product[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    out.push(...(await http<Product[]>("/products/by-ids", { query: { ids: ids.slice(i, i + 50).join(",") } })));
  }
  return rememberProducts(out);
}
