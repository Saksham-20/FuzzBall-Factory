import type { Product } from "@/lib/types";

/**
 * Products seen through the real API (by id). The cart stores only ids, and with the real API the ids are
 * database ids rather than the seed catalogue's, so the cart looks lines up here first.
 */
const cache = new Map<string, Product>();

/** Mock mode only: `lib/mock/db` registers the seed catalogue here, so a real-API build never bundles it. */
let seedLookup: ((id: string) => Product | undefined) | undefined;
export function registerSeedLookup(fn: (id: string) => Product | undefined): void {
  seedLookup = fn;
}

export function rememberProducts(list: Product[]): Product[] {
  for (const p of list) cache.set(p.id, p);
  return list;
}

export const lookupProduct = (id: string): Product | undefined => cache.get(id) ?? seedLookup?.(id);
