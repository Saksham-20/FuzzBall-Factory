"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, Panel, TableWrap, Td, Th } from "@/components/admin/ui";
import { FilterChips, ListSkeleton, SearchBox, Toolbar, stockOf, useDebounced } from "@/components/admin/catalogue/kit";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote, Price } from "@/components/ui/misc";
import { useApi } from "@/lib/api/useApi";
import { listAdminProducts, setProductStatus } from "@/lib/api/admin";
import { listCategories } from "@/lib/api/catalog";
import { batchLabel } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Product, ProductStatus } from "@/lib/types";

type Filter = "ALL" | ProductStatus;

const STATUS_LABEL: Record<ProductStatus, string> = { PUBLISHED: "Published", DRAFT: "Draft", ARCHIVED: "Archived" };
const STATUS_TONE: Record<ProductStatus, "ready" | "mto" | "sold"> = { PUBLISHED: "ready", DRAFT: "mto", ARCHIVED: "sold" };

function Thumb({ p }: { p: Product }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.images[0]?.src} alt="" className="size-12 shrink-0 rounded-[10px] bg-kraft-light object-cover" />
  );
}

function StockText({ p }: { p: Product }) {
  if (p.fulfilment === "MADE_TO_ORDER") return <span className="text-brown-soft">Not tracked</span>;
  const n = stockOf(p);
  return <span className={cn("tabular", n === 0 ? "font-bold text-err" : n <= 2 && "font-bold text-warn")}>{n === 0 ? "Sold out" : n <= 2 ? `${n} left` : n}</span>;
}

function FulfilmentBadges({ p }: { p: Product }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {p.fulfilment === "READY" ? <Badge tone="ready">Ready to ship</Badge> : <Badge tone="mto">Made to order · {p.leadTimeDays}d</Badge>}
      {p.isOneOfAKind ? <Badge tone="ooak">One of one</Badge> : null}
    </span>
  );
}

function NameCell({ p }: { p: Product }) {
  return (
    <span className="min-w-0">
      <Link href={`/admin/products/${p.id}`} className="font-semibold underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">
        {p.name}
      </Link>
      {p.sample ? <Badge tone="sample" className="ml-2 align-middle">Sample</Badge> : null}
    </span>
  );
}

function CheckCell({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="grid size-11 cursor-pointer place-items-center">
      <input type="checkbox" aria-label={label} checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 cursor-pointer rounded-[6px] accent-cocoa" />
    </label>
  );
}

export function ProductsClient() {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const [status, setStatus] = useState<Filter>("ALL");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<ProductStatus | null>(null);

  const list = useApi(() => listAdminProducts(dq || undefined), `products:${dq}`);
  const cats = useApi(listCategories, "categories");
  const catName = useMemo(() => new Map((cats.data ?? []).map((c) => [c.slug, c.name])), [cats.data]);

  const all = list.data;
  const counts = useMemo(() => {
    const c = { ALL: all?.length ?? 0, PUBLISHED: 0, DRAFT: 0, ARCHIVED: 0 };
    all?.forEach((p) => (c[p.status] += 1));
    return c;
  }, [all]);
  const rows = useMemo(() => (all ?? []).filter((p) => status === "ALL" || p.status === status), [all, status]);
  const picked = rows.filter((p) => sel.has(p.id));
  const allPicked = rows.length > 0 && picked.length === rows.length;

  const toggle = (id: string, on: boolean) =>
    setSel((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const toggleAll = (on: boolean) => setSel(on ? new Set(rows.map((p) => p.id)) : new Set());

  async function bulk(to: ProductStatus) {
    if (!picked.length || busy) return;
    setBusy(to);
    try {
      await setProductStatus(picked.map((p) => p.id), to);
      toast.success(`${picked.length} ${picked.length === 1 ? "product" : "products"} ${to === "PUBLISHED" ? "published" : "archived"}.`);
      setSel(new Set());
      list.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update those products. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const initial = list.loading && !all;

  return (
    <AdminPage
      title="Products"
      actions={
        <Button asChild>
          <Link href="/admin/products/new"><Plus strokeWidth={2} /> New product</Link>
        </Button>
      }
    >
      <Toolbar className="justify-between">
        <SearchBox label="Search by name or batch number" value={q} onChange={setQ} className="w-full md:max-w-sm" />
        <FilterChips
          label="Filter by status"
          value={status}
          onChange={(v) => { setStatus(v); setSel(new Set()); }}
          options={[
            { value: "ALL", label: "All", count: counts.ALL },
            { value: "PUBLISHED", label: "Published", count: counts.PUBLISHED },
            { value: "DRAFT", label: "Draft", count: counts.DRAFT },
            { value: "ARCHIVED", label: "Archived", count: counts.ARCHIVED },
          ]}
        />
      </Toolbar>

      {picked.length ? (
        <div role="region" aria-label="Bulk actions" className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-ticket bg-cocoa px-4 py-2 text-cream shadow-lift">
          <p aria-live="polite" className="mr-auto font-semibold">{picked.length} selected</p>
          <Button size="md" variant="tape" onClick={() => bulk("PUBLISHED")} disabled={!!busy}>{busy === "PUBLISHED" ? "Publishing…" : "Publish"}</Button>
          <Button size="md" variant="secondary" onClick={() => bulk("ARCHIVED")} disabled={!!busy}>{busy === "ARCHIVED" ? "Archiving…" : "Archive"}</Button>
          <button type="button" onClick={() => setSel(new Set())} className="press min-h-11 px-3 font-semibold underline">Clear</button>
        </div>
      ) : null}

      {list.error ? (
        <ErrorNote onRetry={list.reload}>{list.error.message || "The product list didn't load."}</ErrorNote>
      ) : initial ? (
        <ListSkeleton rows={7} />
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState
            title={dq || status !== "ALL" ? "No products match" : "No products yet"}
            action={
              dq || status !== "ALL" ? (
                <Button variant="secondary" onClick={() => { setQ(""); setStatus("ALL"); }}>Clear search and filters</Button>
              ) : (
                <Button asChild><Link href="/admin/products/new">Add your first product</Link></Button>
              )
            }
          >
            {dq || status !== "ALL" ? "Try a different word, or show every status." : "Products you add here appear in the shop once you publish them."}
          </EmptyState>
        </Panel>
      ) : (
        <div aria-busy={list.loading} className={cn("transition-opacity duration-150", list.loading && "opacity-60")}>
          {/* Phones: stacked cards */}
          <ul className="space-y-3 md:hidden">
            {rows.map((p) => (
              <li key={p.id} className="flex items-start gap-1 rounded-ticket bg-paper p-2 pr-3 shadow-ticket">
                <CheckCell checked={sel.has(p.id)} onChange={(v) => toggle(p.id, v)} label={`Select ${p.name}`} />
                <Thumb p={p} />
                <div className="min-w-0 flex-1 pl-2">
                  <NameCell p={p} />
                  <p className="font-stencil mt-0.5 text-[11px] text-brown-soft">{batchLabel(p.batch)} · {catName.get(p.category) ?? p.category}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <Price price={p.price} compareAt={p.compareAtPrice} />
                    <StockText p={p} />
                    <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                  </div>
                  <div className="mt-1.5"><FulfilmentBadges p={p} /></div>
                </div>
              </li>
            ))}
          </ul>

          {/* Wider screens: table */}
          <div className="hidden md:block">
            <Panel flush>
              <TableWrap>
                <caption className="sr-only">Products</caption>
                <thead>
                  <tr>
                    <Th className="w-14 px-1.5"><CheckCell checked={allPicked} onChange={toggleAll} label="Select all shown products" /></Th>
                    <Th>Product</Th>
                    <Th>Batch</Th>
                    <Th>Category</Th>
                    <Th>Price</Th>
                    <Th>Stock</Th>
                    <Th>Fulfilment</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className={cn(sel.has(p.id) && "bg-cocoa/5")}>
                      <Td className="w-14 px-1.5 py-1"><CheckCell checked={sel.has(p.id)} onChange={(v) => toggle(p.id, v)} label={`Select ${p.name}`} /></Td>
                      <Td>
                        <span className="flex items-center gap-3"><Thumb p={p} /><NameCell p={p} /></span>
                      </Td>
                      <Td className="font-stencil text-[12px] whitespace-nowrap text-brown">{batchLabel(p.batch)}</Td>
                      <Td>{catName.get(p.category) ?? p.category}</Td>
                      <Td className="whitespace-nowrap"><Price price={p.price} compareAt={p.compareAtPrice} /></Td>
                      <Td className="whitespace-nowrap"><StockText p={p} /></Td>
                      <Td><FulfilmentBadges p={p} /></Td>
                      <Td><Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge></Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Panel>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
