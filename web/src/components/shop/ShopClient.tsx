"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Share2, SlidersHorizontal, X } from "lucide-react";
import { ProductTicket } from "@/components/store/ProductTicket";
import { ShareMenu } from "@/components/store/ShareMenu";
import { FilterPanel } from "@/components/shop/FilterPanel";
import {
  FILTER_KEYS,
  PRICE_PRESETS,
  SORTS,
  countActive,
  parseFilters,
  toQuery,
  type ShopFilters,
  type SortId,
} from "@/components/shop/filters";
import { Button, buttonStyles } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Field";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import { listCategories, listProducts } from "@/lib/api/catalog";
import { useApi } from "@/lib/api/useApi";
import { products as seedProducts } from "@/lib/mock/catalog";
import { cn } from "@/lib/cn";
import { SITE } from "@/lib/site";
import type { Category, Swatch } from "@/lib/types";

const PAGE_SIZE = 12;
const GRID = "grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4";
const TICKET_SIZES = "(min-width:1280px) 22vw, (min-width:768px) 30vw, 46vw";

/** Colour swatches offered in the filter. Derived from the catalogue palette. */
function coloursFor(category?: string): Swatch[] {
  const seen = new Map<string, Swatch>();
  for (const p of seedProducts) {
    if (category && p.category !== category) continue;
    for (const s of p.swatches) if (!seen.has(s.name)) seen.set(s.name, s);
  }
  return [...seen.values()];
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <ul aria-hidden className={GRID}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="rounded-ticket bg-kraft-light/60 p-2.5">
          <Skeleton className="mt-5 aspect-[4/5]" />
          <Skeleton className="mt-3 h-5 w-3/4" />
          <Skeleton className="mt-2 mb-1.5 h-4 w-1/3" />
        </li>
      ))}
    </ul>
  );
}

/** Suspense fallback while the URL params resolve. */
export function ShopFallback({ category }: { category?: Category }) {
  return (
    <>
      <ShopHeader category={category} />
      <div className="shell pt-6 pb-24">
        <SkeletonGrid />
      </div>
    </>
  );
}

function ShopHeader({ category }: { category?: Category }) {
  if (!category) {
    return (
      <div className="shell pt-8 md:pt-12">
        <h1 className="font-display text-[clamp(3rem,9vw,6rem)]">The shelf</h1>
        <p className="mt-3 max-w-[52ch] text-brown">
          Ready to ship, or made to order. The lead time is on every piece before you decide.
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden bg-kraft-light">
      <div className="shell pt-8 md:pt-12">
        <h1 className="font-display text-[clamp(3rem,9vw,6rem)]">{category.name}</h1>
        <p className="mt-3 max-w-[52ch] text-brown">{category.blurb}. Ready to ship, or made to order.</p>
        <div
          aria-hidden
          className="font-display mt-4 -mb-[0.2em] translate-x-[7%] text-right text-[clamp(5rem,20vw,15rem)] leading-[0.8] whitespace-nowrap text-kraft select-none"
        >
          {category.word}
        </div>
      </div>
    </div>
  );
}

export function ShopClient({ category }: { category?: Category }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [sheet, setSheet] = useState(false);

  const filters = useMemo(() => parseFilters(sp), [sp]);
  const search = sp.toString();
  const slug = category?.slug;
  const filterKey = JSON.stringify([slug, filters]);

  // "Load more" count is scoped to the current filters, so any filter change starts over at page 1.
  const [pageState, setPageState] = useState({ key: "", n: 1 });
  const pages = pageState.key === filterKey ? pageState.n : 1;

  const list = useApi(
    async () => ({ key: filterKey, res: await listProducts(toQuery(slug, filters, 1, PAGE_SIZE * pages)) }),
    `${filterKey}:${pages}`,
  );
  const cats = useApi(listCategories, "categories");
  const colours = useMemo(() => coloursFor(slug), [slug]);

  const setFilters = (patch: Partial<ShopFilters>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (!v || (k === "sort" && v === "newest")) next.delete(k);
      else next.set(k, String(v));
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  const clearAll = () => {
    const next = new URLSearchParams(sp.toString());
    for (const k of FILTER_KEYS) if (k !== "sort") next.delete(k);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const fresh = list.data?.key === filterKey;
  const showSkeleton = !list.error && (!list.data || !fresh);
  const loadingMore = list.loading && fresh;
  const items = fresh ? (list.data?.res.items ?? []) : [];
  const total = fresh ? (list.data?.res.total ?? 0) : 0;
  const active = countActive(filters);

  const shareContent = {
    url: `${SITE.url}${pathname}${search ? `?${search}` : ""}`,
    text: category
      ? `${category.name} at FuzzBall Factory — handmade crochet, ready to ship or made to order.`
      : "Handmade crochet at FuzzBall Factory — ready to ship, or made to order.",
  };

  const chips: { label: string; clear: () => void }[] = [];
  if (filters.q) chips.push({ label: `Search: ${filters.q}`, clear: () => setFilters({ q: undefined }) });
  if (filters.price)
    chips.push({ label: PRICE_PRESETS.find((p) => p.id === filters.price)!.label, clear: () => setFilters({ price: undefined }) });
  if (filters.avail)
    chips.push({ label: filters.avail === "ready" ? "Ready to ship" : "Made to order", clear: () => setFilters({ avail: undefined }) });
  if (filters.colour) chips.push({ label: filters.colour, clear: () => setFilters({ colour: undefined }) });
  if (filters.occasion) chips.push({ label: filters.occasion, clear: () => setFilters({ occasion: undefined }) });

  const panel = (
    <FilterPanel
      filters={filters}
      onChange={setFilters}
      category={slug}
      categories={cats.data}
      colours={colours}
      search={search}
    />
  );

  return (
    <>
      <ShopHeader category={category} />

      <div className="shell pt-6 pb-24 lg:grid lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-10">
        <aside
          aria-label="Filters"
          data-lenis-prevent
          className="hidden pr-1 lg:sticky lg:top-[92px] lg:block lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:pb-6"
        >
          {panel}
        </aside>

        <section aria-label="Products" className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <p role="status" aria-live="polite" className="tabular min-h-6 text-[15px] font-medium text-brown">
              {showSkeleton
                ? "Loading the shelf…"
                : total === 0
                  ? "No pieces"
                  : `Showing ${items.length} of ${total} ${total === 1 ? "piece" : "pieces"}`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="lg:hidden"
                aria-haspopup="dialog"
                onClick={() => setSheet(true)}
              >
                <SlidersHorizontal aria-hidden strokeWidth={1.8} />
                Filters{active ? ` (${active})` : ""}
              </Button>
              <ShareMenu content={shareContent} className={buttonStyles({ variant: "secondary" })}>
                <Share2 aria-hidden strokeWidth={1.8} />
                Share
              </ShareMenu>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <span className="sr-only sm:not-sr-only">Sort by</span>
                <Select
                  value={filters.sort}
                  onChange={(e) => setFilters({ sort: e.target.value as SortId })}
                  className="h-11 w-auto min-w-[10.5rem] text-[15px]"
                >
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </label>
            </div>
          </div>

          {chips.length > 0 ? (
            <ul className="mt-4 flex flex-wrap items-center gap-2" aria-label="Active filters">
              {chips.map((c) => (
                <li key={c.label}>
                  <button
                    type="button"
                    onClick={c.clear}
                    aria-label={`Remove filter: ${c.label}`}
                    className={cn(
                      "press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-kraft-light pr-3 pl-4 text-sm font-semibold transition-colors duration-150",
                      `hf:hover:bg-kraft`,
                    )}
                  >
                    {c.label}
                    <X aria-hidden className="size-4" strokeWidth={2} />
                  </button>
                </li>
              ))}
              <li>
                <button type="button" onClick={clearAll} className="min-h-11 px-2 text-sm font-semibold underline">
                  Clear all
                </button>
              </li>
            </ul>
          ) : null}

          <div className="mt-6">
            {list.error ? (
              <ErrorNote onRetry={list.reload}>
                {list.error.message || "The shelf didn't load."} Check your connection and try again.
              </ErrorNote>
            ) : showSkeleton ? (
              <SkeletonGrid />
            ) : items.length === 0 ? (
              <EmptyState
                title={active ? "Nothing on this shelf with those filters" : "This shelf is empty right now"}
                action={
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    {active ? (
                      <Button type="button" onClick={clearAll}>
                        Clear filters
                      </Button>
                    ) : (
                      <Button asChild>
                        <Link href="/shop">See the whole shelf</Link>
                      </Button>
                    )}
                    <Button asChild variant="secondary">
                      <Link href="/custom">Put in a work order instead</Link>
                    </Button>
                  </div>
                }
              >
                {active
                  ? "Loosen a filter, or tell us what you have in mind and we will make it."
                  : "New pieces land here as they come off the hook. You can also ask for something made just for you."}
              </EmptyState>
            ) : (
              <>
                <ul className={GRID}>
                  {items.map((p, i) => (
                    <li key={p.id}>
                      <ProductTicket product={p} priority={i < 4} sizes={TICKET_SIZES} />
                    </li>
                  ))}
                </ul>
                {items.length < total ? (
                  <div className="mt-10 flex justify-center">
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      disabled={loadingMore}
                      aria-busy={loadingMore}
                      onClick={() => setPageState({ key: filterKey, n: pages + 1 })}
                    >
                      {loadingMore ? "Loading more…" : `Load more (${total - items.length} left)`}
                    </Button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>

      <Drawer
        open={sheet}
        onOpenChange={setSheet}
        title="Filters"
        footer={
          <>
            <Button type="button" variant="ghost" onClick={clearAll} disabled={active === 0}>
              Clear all
            </Button>
            <Button type="button" onClick={() => setSheet(false)}>
              {showSkeleton ? "Show pieces" : `Show ${total} ${total === 1 ? "piece" : "pieces"}`}
            </Button>
          </>
        }
      >
        <div className="pt-2 pb-6">{panel}</div>
      </Drawer>
    </>
  );
}
