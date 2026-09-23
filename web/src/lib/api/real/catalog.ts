import { http } from "@/lib/api/http";
import { rememberProducts } from "@/lib/state/productCache";
import type { Category, Product } from "@/lib/types";
import type { Page, ProductQuery } from "@/lib/api/catalog";

export const listCategories = () => http<Category[]>("/categories");

export async function listProducts(query: ProductQuery = {}): Promise<Page<Product>> {
  // The API caps pageSize at 100 (the wishlist asks for 200).
  const pageSize = query.pageSize ? Math.min(100, Math.max(1, query.pageSize)) : undefined;
  const page = await http<Page<Product>>("/products", { query: { ...query, pageSize } });
  rememberProducts(page.items);
  return page;
}

export async function getProduct(slug: string): Promise<Product> {
  const p = await http<Product>(`/products/${encodeURIComponent(slug)}`);
  rememberProducts([p]);
  return p;
}

export async function relatedProducts(slug: string, limit = 4): Promise<Product[]> {
  return rememberProducts(await http<Product[]>(`/products/${encodeURIComponent(slug)}/related`, { query: { limit } }));
}
