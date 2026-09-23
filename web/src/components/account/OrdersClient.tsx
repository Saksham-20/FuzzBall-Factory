"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { AccountHeading } from "@/components/account/AccountShell";
import { OrderThumbs } from "@/components/account/OrderThumbs";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import { OrderStamp } from "@/components/ui/StatusStamp";
import * as orders from "@/lib/api/orders";
import { useApi } from "@/lib/api/useApi";
import { formatDate, formatINR } from "@/lib/format";
import type { Order } from "@/lib/types";


export function OrdersClient() {
  const { data, error, loading, reload } = useApi(orders.listMyOrders, "my-orders");

  return (
    <div>
      <AccountHeading title="Orders" />
      <div className="mt-8" aria-live="polite">
        {loading && !data ? (
          <ul className="space-y-4" aria-label="Loading orders">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-40 rounded-ticket" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <ErrorNote onRetry={reload}>{error.message}</ErrorNote>
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="No orders yet"
            action={
              <Button asChild>
                <Link href="/shop">Browse the shop</Link>
              </Button>
            }
          >
            When you place an order it lands here, with a status you can follow from the first stitch to your door.
          </EmptyState>
        ) : (
          <ul className="space-y-4">
            {data.map((o) => (
              <li key={o.number}>
                <OrderRow order={o} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function OrderRow({ order: o }: { order: Order }) {
  const first = o.items[0];
  const rest = o.items.length - 1;
  return (
    <Ticket
      head={[o.number, formatDate(o.createdAt, { day: "numeric", month: "short", year: "numeric" })]}
      className={`px-4 pb-4 transition-shadow duration-200 ease-out hf:hover:shadow-lift`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-4">
          <OrderThumbs items={o.items} />
          <div className="min-w-0">
            <p className="truncate font-semibold">
              <Link href={`/account/orders/${o.number}`} className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-4">
                {first.name}
                <span className="sr-only">, order {o.number}</span>
              </Link>
            </p>
            <p className="text-[15px] text-brown">{rest > 0 ? `and ${rest} more ${rest === 1 ? "piece" : "pieces"}` : first.colour}</p>
          </div>
        </div>
        <OrderStamp status={o.status} className="shrink-0" />
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-dashed border-kraft-deep/60 pt-3">
        <p className="tabular font-bold">{formatINR(o.total)}</p>
        <span aria-hidden className="flex items-center gap-1 text-[15px] font-semibold text-brown">
          Details
          <ChevronRight className="size-4" strokeWidth={2} />
        </span>
      </div>
    </Ticket>
  );
}
