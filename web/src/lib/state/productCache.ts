import type { Product } from "@/lib/types";
import { productById } from "@/lib/mock/catalog";

/**
 * Products seen through the real API (by id). The cart stores only ids, and with the real API the ids are
 * database ids rather than the seed catalogue's, so the cart looks lines up here first and falls back to the seed.
 */
const cache = new Map<string, Product>();

export function rememberProducts(list: Product[]): Product[] {
  for (const p of list) cache.set(p.id, p);
  return list;
}

export const lookupProduct = (id: string): Product | undefined => cache.get(id) ?? productById(id);
