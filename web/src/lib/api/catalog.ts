import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/catalog";
import { db, wait, ApiError } from "@/lib/mock/db";
import type { Category, Product } from "@/lib/types";

export interface ProductQuery {
  category?: string;
  q?: string;
  sort?: "newest" | "price-asc" | "price-desc" | "ready-first";
  min?: number;
  max?: number;
  availability?: "ready" | "mto";
  colour?: string;
  occasion?: string;
  page?: number;
  pageSize?: number;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listCategories(): Promise<Category[]> {
  if (!SITE.useMock) return real.listCategories();
  await wait(150);
  return db.get().categories;
}

export async function listProducts(query: ProductQuery = {}): Promise<Page<Product>> {
  if (!SITE.useMock) return real.listProducts(query);
  await wait(300);
  const { category, q, sort = "newest", min, max, availability, colour, occasion, page = 1, pageSize = 12 } = query;
  let items = db.get().products.filter((p) => p.status === "PUBLISHED");
  if (category) items = items.filter((p) => p.category === category);
  if (q) {
    const s = q.toLowerCase();
    items = items.filter((p) => [p.name, p.tagline, p.description, ...p.tags].join(" ").toLowerCase().includes(s));
  }
  if (min != null) items = items.filter((p) => p.price >= min);
  if (max != null) items = items.filter((p) => p.price <= max);
  if (availability === "ready") items = items.filter((p) => p.fulfilment === "READY");
  if (availability === "mto") items = items.filter((p) => p.fulfilment === "MADE_TO_ORDER");
  if (colour) items = items.filter((p) => p.swatches.some((s) => s.name.toLowerCase() === colour.toLowerCase()));
  if (occasion) items = items.filter((p) => p.occasions.includes(occasion));
  const soldOut = (p: Product) => p.variants.every((v) => v.stock === 0);
  const byNew = (a: Product, b: Product) => b.createdAt.localeCompare(a.createdAt);
  items = [...items].sort((a, b) => {
    if (soldOut(a) !== soldOut(b)) return soldOut(a) ? 1 : -1; // sold out always last
    if (sort === "price-asc") return a.price - b.price;
    if (sort === "price-desc") return b.price - a.price;
    if (sort === "ready-first") return a.fulfilment === b.fulfilment ? byNew(a, b) : a.fulfilment === "READY" ? -1 : 1;
    return byNew(a, b);
  });
  const total = items.length;
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize };
}

export async function getProduct(slug: string): Promise<Product> {
  if (!SITE.useMock) return real.getProduct(slug);
  await wait(200);
  const p = db.get().products.find((x) => x.slug === slug && x.status === "PUBLISHED");
  if (!p) throw new ApiError(404, "We couldn't find that piece.");
  return p;
}

export async function relatedProducts(slug: string, limit = 4): Promise<Product[]> {
  if (!SITE.useMock) return real.relatedProducts(slug, limit);
  await wait(150);
  const all = db.get().products.filter((p) => p.status === "PUBLISHED");
  const cur = all.find((p) => p.slug === slug);
  const same = all.filter((p) => p.slug !== slug && p.category === cur?.category);
  const rest = all.filter((p) => p.slug !== slug && p.category !== cur?.category);
  return [...same, ...rest].slice(0, limit);
}
