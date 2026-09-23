import type { ProductQuery } from "@/lib/api/catalog";

export const PRICE_PRESETS = [
  { id: "u500", label: "Under ₹500", max: 499 },
  { id: "500-1000", label: "₹500 – 1,000", min: 500, max: 1000 },
  { id: "1000-2000", label: "₹1,000 – 2,000", min: 1001, max: 2000 },
  { id: "2000p", label: "₹2,000 and up", min: 2001 },
] as const;

export const OCCASIONS = ["Birthday", "Anniversary", "Valentine's", "Baby shower", "Rakhi", "Just because"] as const;

export const SORTS = [
  { id: "newest", label: "Newest" },
  { id: "price-asc", label: "Price: low to high" },
  { id: "price-desc", label: "Price: high to low" },
  { id: "ready-first", label: "Ready to ship first" },
] as const;

export type SortId = (typeof SORTS)[number]["id"];

/** The filter state that lives in the URL (`?price=&avail=&colour=&occasion=&sort=&q=`). */
export interface ShopFilters {
  price?: string;
  avail?: "ready" | "mto";
  colour?: string;
  occasion?: string;
  sort: SortId;
  q?: string;
}

export const FILTER_KEYS = ["price", "avail", "colour", "occasion", "sort", "q"] as const;

type Params = { get(name: string): string | null };

/** Reads and validates filters from URL params; anything unknown is dropped. */
export function parseFilters(sp: Params): ShopFilters {
  const price = sp.get("price");
  const avail = sp.get("avail");
  const occasion = sp.get("occasion");
  const sort = sp.get("sort");
  return {
    price: PRICE_PRESETS.some((p) => p.id === price) ? (price as string) : undefined,
    avail: avail === "ready" || avail === "mto" ? avail : undefined,
    colour: sp.get("colour")?.slice(0, 40) || undefined,
    occasion: OCCASIONS.some((o) => o === occasion) ? (occasion as string) : undefined,
    sort: SORTS.some((s) => s.id === sort) ? (sort as SortId) : "newest",
    q: sp.get("q")?.trim().slice(0, 60) || undefined,
  };
}

export function toQuery(category: string | undefined, f: ShopFilters, page: number, pageSize: number): ProductQuery {
  const preset = PRICE_PRESETS.find((p) => p.id === f.price);
  return {
    category,
    q: f.q,
    sort: f.sort,
    min: preset && "min" in preset ? preset.min : undefined,
    max: preset && "max" in preset ? preset.max : undefined,
    availability: f.avail,
    colour: f.colour,
    occasion: f.occasion,
    page,
    pageSize,
  };
}

/** Number of active filters, not counting sort. */
export function countActive(f: ShopFilters) {
  return [f.price, f.avail, f.colour, f.occasion, f.q].filter(Boolean).length;
}
