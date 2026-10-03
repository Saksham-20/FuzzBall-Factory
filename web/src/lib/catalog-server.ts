import type { Category, Product } from "@/lib/types";
import { SITE } from "@/lib/site";

/**
 * The catalogue as the SERVER sees it (routing, metadata, JSON-LD, the sitemap, the header and footer menus, the
 * home page). Mock mode reads the seed catalogue; real mode asks the API, and Next caches each answer for a couple
 * of minutes (tag `catalog`), so the storefront never hammers the API and a product edit shows up shortly after.
 *
 * Reads that only decorate a page (menus, home shelf, sitemap) return an empty list if the API is down rather than
 * failing the page; `serverProduct` throws on anything but a clean 404, so an outage is never mistaken for
 * "this piece does not exist" (a soft 404 that search engines would remember).
 */
const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");
const REVALIDATE_SECONDS = 120;
const FETCH_TIMEOUT_MS = 8000;

async function api<T>(path: string): Promise<{ status: number; body?: T }> {
  const res = await fetch(`${API}${path}`, { next: { revalidate: REVALIDATE_SECONDS, tags: ["catalog"] }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (res.status === 404) return { status: 404 };
  if (!res.ok) throw new Error(`Catalogue request ${path} failed with ${res.status}`);
  return { status: res.status, body: (await res.json()) as T };
}

/** Never throws: an empty list is the right thing to show when the catalogue is unreachable. */
async function orEmpty<T>(work: () => Promise<T[]>): Promise<T[]> {
  try {
    return await work();
  } catch {
    return [];
  }
}

async function loadCategories(): Promise<Category[]> {
  if (SITE.useMock) return (await import("@/lib/mock/catalog")).categories;
  return (await api<Category[]>("/categories")).body ?? [];
}

/** For menus and the like: an empty list when the API is unreachable. */
export function serverCategories(): Promise<Category[]> {
  return orEmpty(loadCategories);
}

/**
 * Shelves that have something on them. Menus and the sitemap use this, so an empty shelf (and a brand-new shop with no
 * products yet) never shows a dead link. A shelf's own page still renders, with an empty state.
 */
export function serverActiveCategories(): Promise<Category[]> {
  return orEmpty(async () => {
    const [categories, products] = await Promise.all([loadCategories(), serverProducts()]);
    const used = new Set(products.map((p) => p.category));
    return categories.filter((c) => used.has(c.slug));
  });
}

/** Published products, newest first: all of them, or one category's. Pages through the API (100 at a time). */
export function serverProducts(opts: { category?: string; max?: number } = {}): Promise<Product[]> {
  return orEmpty(async () => {
    if (SITE.useMock) {
      const { products } = await import("@/lib/mock/catalog");
      return products.filter((p) => p.status === "PUBLISHED" && (!opts.category || p.category === opts.category)).slice(0, opts.max);
    }
    const out: Product[] = [];
    for (let page = 1; ; page += 1) {
      const qs = new URLSearchParams({ page: String(page), pageSize: "100", sort: "newest", ...(opts.category ? { category: opts.category } : {}) });
      const body = (await api<{ items: Product[]; total: number }>(`/products?${qs}`)).body;
      if (!body) break;
      out.push(...body.items);
      if (out.length >= body.total || body.items.length === 0 || (opts.max && out.length >= opts.max)) break;
    }
    return opts.max ? out.slice(0, opts.max) : out;
  });
}

/** One product by slug: `null` when it does not exist (or is not published). Throws on any other failure. */
export async function serverProduct(slug: string): Promise<Product | null> {
  if (SITE.useMock) return (await import("@/lib/mock/catalog")).getProduct(slug) ?? null;
  const res = await api<Product>(`/products/${encodeURIComponent(slug)}`);
  return res.status === 404 ? null : (res.body ?? null);
}

/** One category, `null` when it does not exist. Throws when the API is unreachable, so an outage is not a 404. */
export async function serverCategory(slug: string): Promise<Category | null> {
  return (await loadCategories()).find((c) => c.slug === slug) ?? null;
}
