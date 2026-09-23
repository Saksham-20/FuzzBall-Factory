import Link from "next/link";
import type { ReactNode } from "react";
import { Panel } from "@/components/admin/ui";
import type { WorkshopLoad } from "@/lib/api/admin";

function Row({ label, value, href }: { label: string; value: ReactNode; href: string }) {
  return (
    <Link href={href} className="press flex min-h-11 items-baseline justify-between gap-4 border-b border-line py-2.5 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">
      <span className="text-brown">{label}</span>
      <span className="tabular font-bold">{value}</span>
    </Link>
  );
}

/**
 * Aggregate load across both fulfilment streams (ready-stock and made-to-order), so a maker running
 * both can see the queue at a glance — distinct from "Needs you", which lists individual items.
 */
export function WorkshopLoadPanel({ load, className }: { load: WorkshopLoad; className?: string }) {
  return (
    <Panel title="Workshop load" className={className}>
      <div className="space-y-4">
        <dl>
          <Row label="Pieces in production or packing" value={load.ordersInProduction} href="/admin/orders" />
          <Row label="Custom work orders in progress" value={load.customInProgress} href="/admin/custom" />
          <Row label="Oldest piece in progress" value={load.oldestDays === null ? "—" : `${load.oldestDays} day${load.oldestDays === 1 ? "" : "s"}`} href="/admin/orders" />
        </dl>
        <p className="text-sm text-brown-soft">{load.summary}</p>
      </div>
    </Panel>
  );
}
