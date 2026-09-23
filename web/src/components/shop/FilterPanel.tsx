"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SwatchPicker } from "@/components/ui/misc";
import { OCCASIONS, PRICE_PRESETS, type ShopFilters } from "@/components/shop/filters";
import { cn } from "@/lib/cn";
import type { Category, Swatch } from "@/lib/types";


export function Chip({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "press inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold transition-colors duration-150",
        on
          ? "bg-cocoa text-cream"
          : `bg-paper text-cocoa ring-1 ring-line-strong hf:hover:bg-kraft-light`,
      )}
    >
      {children}
    </button>
  );
}

function Group({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="mb-3 p-0 text-[15px] font-bold">{legend}</legend>
      {children}
    </fieldset>
  );
}

interface Props {
  filters: ShopFilters;
  onChange: (patch: Partial<ShopFilters>) => void;
  /** Slug of the category page we're on, if any. */
  category?: string;
  categories?: Category[];
  colours: Swatch[];
  /** Current query string (without "?"), so category links keep the filters. */
  search: string;
}

/** The filter controls. Rendered in the desktop rail and inside the mobile drawer. */
export function FilterPanel({ filters, onChange, category, categories, colours, search }: Props) {
  const suffix = search ? `?${search}` : "";
  const toggle = <K extends keyof ShopFilters>(key: K, value: ShopFilters[K]) =>
    onChange({ [key]: filters[key] === value ? undefined : value } as Partial<ShopFilters>);

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Shelves">
        <p className="mb-3 text-[15px] font-bold">Shelf</p>
        <ul className="-mx-3 flex flex-col">
          <li>
            <ShelfLink href={`/shop${suffix}`} current={!category}>
              Everything
            </ShelfLink>
          </li>
          {categories
            ? categories.map((c) => (
                <li key={c.slug}>
                  <ShelfLink href={`/shop/${c.slug}${suffix}`} current={category === c.slug}>
                    {c.name}
                  </ShelfLink>
                </li>
              ))
            : Array.from({ length: 5 }, (_, i) => (
                <li key={i} aria-hidden className="px-3 py-3">
                  <span className="block h-4 w-32 animate-pulse rounded bg-kraft-light motion-reduce:animate-none" />
                </li>
              ))}
        </ul>
      </nav>

      <Group legend="Price">
        <div className="flex flex-wrap gap-2">
          {PRICE_PRESETS.map((p) => (
            <Chip key={p.id} on={filters.price === p.id} onClick={() => toggle("price", p.id)}>
              {p.label}
            </Chip>
          ))}
        </div>
      </Group>

      <Group legend="Availability">
        <div className="flex flex-wrap gap-2">
          <Chip on={filters.avail === "ready"} onClick={() => toggle("avail", "ready")}>
            Ready to ship
          </Chip>
          <Chip on={filters.avail === "mto"} onClick={() => toggle("avail", "mto")}>
            Made to order
          </Chip>
        </div>
      </Group>

      <Group legend="Colour">
        <SwatchPicker
          label="Colour"
          swatches={colours}
          value={filters.colour ? [filters.colour] : []}
          onChange={(names) => toggle("colour", names[0])}
        />
        <p aria-live="polite" className="mt-2 min-h-5 text-sm text-brown">
          {filters.colour ? `Showing ${filters.colour}. Tap it again to clear.` : "Tap a colour to filter."}
        </p>
      </Group>

      <Group legend="Occasion">
        <div className="flex flex-wrap gap-2">
          {OCCASIONS.map((o) => (
            <Chip key={o} on={filters.occasion === o} onClick={() => toggle("occasion", o)}>
              {o}
            </Chip>
          ))}
        </div>
      </Group>
    </div>
  );
}

function ShelfLink({ href, current, children }: { href: string; current: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center rounded-[10px] px-3 text-[15px] transition-colors duration-150",
        current ? "bg-kraft-light font-bold" : `font-medium text-brown hf:hover:bg-cocoa/8`,
      )}
    >
      {children}
    </Link>
  );
}
