"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AdminPage, Panel, TableWrap, Td, Th } from "@/components/admin/ui";
import { Input } from "@/components/ui/Field";
import { EmptyState, ErrorNote } from "@/components/ui/misc";
import { OrderStamp } from "@/components/ui/StatusStamp";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { listAdminOrders } from "@/lib/api/admin";
import { useApi } from "@/lib/api/useApi";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Order } from "@/lib/types";
import {
  ENDED_STATUSES, ORDER_TABS, rowStampClass, PAYMENT_STATUS_LABEL, hasMadeToOrder, isCodToConfirm, isOrderTab, itemsLabel, paymentMethodLabel, type OrderTab,
} from "./helpers";
import { OrderRowsSkeleton } from "./OrdersSkeleton";


function useDebounced<T>(value: T, ms = 250) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const orderHref = (o: Order) => `/admin/orders/${encodeURIComponent(o.number)}`;

export function OrdersClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get("status");
  const tab: OrderTab = isOrderTab(raw) ? raw : "ALL";
  const tabDef = ORDER_TABS.find((t) => t.value === tab)!;

  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());

  const list = useApi(() => listAdminOrders({ status: tabDef.api, q: dq || undefined }), `orders:${tab}:${dq}`);
  // Unfiltered list only feeds the tab counts. (Real API: a counts endpoint.)
  const all = useApi(() => listAdminOrders(), "orders:all");

  const counts = useMemo(() => {
    const os = all.data ?? [];
    return {
      TO_CONFIRM: os.filter(isCodToConfirm).length,
      TO_MAKE: os.filter((o) => ["CONFIRMED", "IN_PRODUCTION"].includes(o.status) && hasMadeToOrder(o)).length,
      TO_PACK: os.filter((o) => ["CONFIRMED", "IN_PRODUCTION"].includes(o.status)).length,
    } as Partial<Record<OrderTab, number>>;
  }, [all.data]);

  const rows = useMemo(() => (tab === "ENDED" ? list.data?.filter((o) => ENDED_STATUSES.includes(o.status)) : list.data), [tab, list.data]);

  const setTab = (v: string) => router.replace(v === "ALL" ? pathname : `${pathname}?status=${v}`, { scroll: false });
  const stale = list.loading && !!list.data;

  return (
    <AdminPage title="Orders">
      <div className="relative max-w-md">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-brown-soft" strokeWidth={1.8} />
        <Input type="search" aria-label="Search orders by number, name or phone" placeholder="Search number, name or phone" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Order status">
          {ORDER_TABS.map((t) => {
            const n = counts[t.value];
            return (
              <TabsTrigger key={t.value} value={t.value} className="group">
                {t.label}
                {n ? (
                  <span className="tabular rounded-full bg-cocoa/12 px-2 py-0.5 text-xs leading-none group-data-[state=active]:bg-cream/20">
                    <span className="sr-only">, </span>
                    {n}
                    <span className="sr-only"> waiting</span>
                  </span>
                ) : null}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value={tab} className="mt-4 outline-none" aria-busy={list.loading}>
          {list.error && !list.data ? (
            <ErrorNote onRetry={list.reload}>{list.error.message || "We couldn't load orders."}</ErrorNote>
          ) : !rows ? (
            <OrderRowsSkeleton />
          ) : rows.length === 0 ? (
            <Panel>
              <EmptyState
                title={dq ? "Nothing matches" : "No orders here"}
                action={dq ? <Button variant="secondary" onClick={() => setQ("")}>Clear search</Button> : tab !== "ALL" ? <Button variant="secondary" onClick={() => setTab("ALL")}>Show all orders</Button> : undefined}
              >
                {dq ? `No ${tab === "ALL" ? "" : "matching "}orders for “${dq}”. Try an order number, a name or a phone number.` : tab === "TO_CONFIRM" ? "No cash-on-delivery orders are waiting for a WhatsApp confirmation." : "When orders land in this stage, they show up here."}
              </EmptyState>
            </Panel>
          ) : (
            <div className={cn("transition-opacity duration-150", stale && "opacity-60")}>
              <p aria-live="polite" className="mb-3 text-sm text-brown">{rows.length} {rows.length === 1 ? "order" : "orders"}</p>
              <DesktopTable rows={rows} onOpen={(o) => router.push(orderHref(o))} />
              <MobileList rows={rows} />
            </div>
          )}
        </TabsContent>
      </Tabs>
    </AdminPage>
  );
}

function PaymentCell({ o }: { o: Order }) {
  return (
    <>
      <span className="block font-semibold">{paymentMethodLabel(o)}</span>
      <span className="block text-sm text-brown">{PAYMENT_STATUS_LABEL[o.paymentStatus]}</span>
    </>
  );
}

function DesktopTable({ rows, onOpen }: { rows: Order[]; onOpen: (o: Order) => void }) {
  return (
    <Panel flush className="hidden overflow-hidden md:block">
      <TableWrap>
        <caption className="sr-only">Orders, newest first</caption>
        <thead>
          <tr>
            <Th>Order</Th>
            <Th>Customer</Th>
            <Th className="text-right">Total</Th>
            <Th>Payment</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((o) => (
            <tr
              key={o.number}
              onClick={(e) => { if (!(e.target as HTMLElement).closest("a")) onOpen(o); }}
              className={cn("cursor-pointer transition-colors duration-150", "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/5")}
            >
              <Td className="whitespace-nowrap">
                <Link href={orderHref(o)} className="font-stencil rounded-sm text-[15px] underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">{o.number}</Link>
                <span className="tabular block text-sm text-brown-soft">{formatDate(o.createdAt)}</span>
              </Td>
              <Td>
                <span className="block font-semibold">{o.contact.name}</span>
                <span className="block text-sm text-brown">{itemsLabel(o)} · {o.address.city}</span>
              </Td>
              <Td className="tabular text-right font-bold whitespace-nowrap">{formatINR(o.total)}</Td>
              <Td className="whitespace-nowrap"><PaymentCell o={o} /></Td>
              <Td>
                <OrderStamp status={o.status} className={rowStampClass(o.status)} />
                {isCodToConfirm(o) ? <span className="mt-1 block text-xs font-semibold">Confirm on WhatsApp</span> : null}
              </Td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </Panel>
  );
}

function MobileList({ rows }: { rows: Order[] }) {
  return (
    <ul className="space-y-3 md:hidden" aria-label="Orders, newest first">
      {rows.map((o) => (
        <li key={o.number}>
          <Link href={orderHref(o)} className={cn("press block rounded-ticket bg-paper p-4 shadow-ticket transition-shadow duration-150", "[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-lift")}>
            <span className="flex items-start justify-between gap-3">
              <span className="font-stencil text-base">{o.number}</span>
              <OrderStamp status={o.status} className={rowStampClass(o.status)} />
            </span>
            <span className="mt-1 block font-semibold">{o.contact.name}</span>
            <span className="block text-sm text-brown">{itemsLabel(o)} · {o.address.city}</span>
            <span className="mt-2 flex items-baseline justify-between gap-3">
              <span className="tabular text-lg font-bold">{formatINR(o.total)}</span>
              <span className="text-right text-sm text-brown">{paymentMethodLabel(o)} · {PAYMENT_STATUS_LABEL[o.paymentStatus]}</span>
            </span>
            <span className="mt-1 flex items-center justify-between gap-3 text-sm text-brown-soft">
              <span className="tabular">{formatDate(o.createdAt)}</span>
              {isCodToConfirm(o) ? <span className="font-semibold text-cocoa">Confirm on WhatsApp</span> : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
