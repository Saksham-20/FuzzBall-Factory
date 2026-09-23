"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Banknote, ChevronRight, ClipboardList, Hourglass, PackageCheck, Reply, type LucideIcon } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/ui";
import { ago, stockOf } from "@/components/admin/catalogue/kit";
import { RevenueChart } from "@/components/admin/dashboard/RevenueChart";
import { WorkshopLoadPanel } from "@/components/admin/dashboard/WorkshopLoadPanel";
import { ErrorNote, Skeleton } from "@/components/ui/misc";
import { useApi } from "@/lib/api/useApi";
import { dashboard, type Dashboard, type NeedsYou } from "@/lib/api/admin";
import { batchLabel, formatINR } from "@/lib/format";

const KIND: Record<NeedsYou["kind"], { label: string; icon: LucideIcon }> = {
  cod: { label: "COD to confirm", icon: Banknote },
  quote: { label: "Quote to make", icon: ClipboardList },
  counter: { label: "Counter to answer", icon: Reply },
  expiring: { label: "Quote expiring", icon: Hourglass },
  pack: { label: "Make or pack", icon: PackageCheck },
  "approval-wait": { label: "Waiting on approval", icon: Hourglass },
};

const SHOW = 8;

function NeedsYouList({ items }: { items: NeedsYou[] }) {
  const [all, setAll] = useState(false);
  if (!items.length) return <p className="py-2 text-brown">Nothing is waiting on you right now.</p>;
  const shown = all ? items : items.slice(0, SHOW);
  return (
    <>
      <ul className="-mx-2 divide-y divide-line">
        {shown.map((n, i) => {
          const k = KIND[n.kind];
          return (
            <li key={`${n.href}-${n.kind}-${i}`}>
              <Link href={n.href} className="press flex min-h-14 items-center gap-3 rounded-[10px] px-2 py-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/6">
                <k.icon aria-hidden className="size-5 shrink-0 text-brown" strokeWidth={1.8} />
                <span className="min-w-0 flex-1">
                  <span className="font-stencil block text-[11px] text-brown-soft">{k.label}</span>
                  <span className="block font-semibold">{n.label}</span>
                </span>
                <span className="tabular shrink-0 text-sm text-brown-soft">{ago(n.at)}</span>
                <ChevronRight aria-hidden className="size-4 shrink-0 text-brown-soft" strokeWidth={1.8} />
              </Link>
            </li>
          );
        })}
      </ul>
      {items.length > SHOW ? (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="press mt-2 min-h-11 text-sm font-semibold underline">
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      ) : null}
    </>
  );
}

function Row({ label, value, href }: { label: string; value: ReactNode; href?: string }) {
  const inner = (
    <>
      <dt className="text-brown">{label}</dt>
      <dd className="tabular font-bold">{value}</dd>
    </>
  );
  return href ? (
    <Link href={href} className="press flex min-h-11 items-baseline justify-between gap-4 border-b border-line py-2.5 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">
      {inner}
    </Link>
  ) : (
    <div className="flex min-h-11 items-baseline justify-between gap-4 border-b border-line py-2.5">{inner}</div>
  );
}

function Numbers({ d }: { d: Dashboard }) {
  return (
    <div className="space-y-4">
      <dl>
        <Row label="Orders today" value={d.ordersToday} href="/admin/orders" />
        <Row label="Revenue today" value={formatINR(d.revenue.today)} />
        <Row label="Revenue, last 7 days" value={formatINR(d.revenue.d7)} />
        <Row label="Revenue, last 30 days" value={formatINR(d.revenue.d30)} />
        <Row label="COD orders to confirm" value={d.pendingCod} href="/admin/orders" />
      </dl>
      <dl>
        <Row label="Work orders to quote" value={d.toQuote} href="/admin/custom" />
        <Row label="Quotes awaiting customer" value={d.awaitingCustomer} href="/admin/custom" />
        <Row label="Work orders in progress" value={d.inProgress} href="/admin/custom" />
      </dl>
      <p className="text-sm text-brown-soft">Revenue counts paid orders only. Cash on delivery counts once it is delivered.</p>
    </div>
  );
}

function LowStock({ items }: { items: Dashboard["lowStock"] }) {
  if (!items.length) return <p className="py-2 text-brown">No ready-to-ship piece is running low.</p>;
  return (
    <ul className="-mx-2 divide-y divide-line">
      {items.map((p) => {
        const n = stockOf(p);
        return (
          <li key={p.id}>
            <Link href={`/admin/products/${p.id}`} className="press flex min-h-14 items-center gap-3 rounded-[10px] px-2 py-2 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.images[0]?.src} alt="" className="size-10 shrink-0 rounded-[8px] bg-kraft-light object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{p.name}</span>
                <span className="font-stencil block text-[11px] text-brown-soft">{batchLabel(p.batch)}</span>
              </span>
              <span className="tabular shrink-0 text-sm font-bold">{n === 0 ? "Sold out" : `${n} left`}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function DashSkeleton() {
  return (
    <div role="status" aria-label="Loading the dashboard" className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Skeleton className="h-64" />
      <Skeleton className="h-64" />
      <Skeleton className="h-60" />
      <Skeleton className="h-40" />
      <Skeleton className="h-40" />
    </div>
  );
}

export function DashboardClient() {
  const { data, error, loading, reload } = useApi(dashboard, "dashboard");
  return (
    <AdminPage title="Dashboard">
      {error ? (
        <ErrorNote onRetry={reload}>{error.message || "The dashboard didn't load."}</ErrorNote>
      ) : loading || !data ? (
        <DashSkeleton />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Panel title={`Needs you${data.needsYou.length ? ` (${data.needsYou.length})` : ""}`} className="lg:col-start-1">
            <NeedsYouList items={data.needsYou} />
          </Panel>
          <Panel title="Numbers" className="lg:col-start-2 lg:row-start-1">
            <Numbers d={data} />
          </Panel>
          <Panel title="Paid revenue, last 30 days" className="lg:col-start-1">
            <RevenueChart days={data.revenueByDay} />
          </Panel>
          <Panel title="Running low" className="lg:col-start-2">
            <LowStock items={data.lowStock} />
          </Panel>
          <WorkshopLoadPanel load={data.workshopLoad} className="lg:col-start-1" />
        </div>
      )}
    </AdminPage>
  );
}
