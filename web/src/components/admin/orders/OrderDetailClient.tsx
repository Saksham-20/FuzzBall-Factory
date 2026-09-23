"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Copy, Gift, MessageCircle, Printer } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import { OrderStamp } from "@/components/ui/StatusStamp";
import { EventLog, Timeline, type TimelineStep } from "@/components/ui/Timeline";
import { getAdminOrder } from "@/lib/api/admin";
import { useApi } from "@/lib/api/useApi";
import { formatDate, formatINR } from "@/lib/format";
import { ApiError } from "@/lib/mock/db";
import { ORDER_FLOW } from "@/lib/status";
import type { Order } from "@/lib/types";
import { OrderActions } from "./OrderActions";
import { PackingSlip } from "./PackingSlip";
import { ENDED_STATUSES, PAYMENT_STATUS_LABEL, addressText, countryName, hasMadeToOrder, isGift, orderWhatsApp, paymentMethodLabel } from "./helpers";

function BackLink() {
  return (
    <Link href="/admin/orders" className="press -ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[15px] font-semibold text-brown underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">
      <ChevronLeft className="size-[18px]" strokeWidth={1.8} /> All orders
    </Link>
  );
}

export function OrderDetailClient({ number }: { number: string }) {
  const { data: order, error, loading, reload, setData } = useApi(() => getAdminOrder(number), `order:${number}`);
  // Gift orders leave prices off the packing slip unless the maker opts back in.
  const [showPrices, setShowPrices] = useState(false);

  if (error && !order) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className="space-y-4">
        <BackLink />
        {missing ? (
          <Panel>
            <EmptyState title="No such order" action={<Button asChild variant="secondary"><Link href="/admin/orders">Back to orders</Link></Button>}>
              We couldn&apos;t find an order numbered {number}. Check the number, or search from the orders list.
            </EmptyState>
          </Panel>
        ) : (
          <ErrorNote onRetry={reload}>{error.message || "We couldn't load this order."}</ErrorNote>
        )}
      </div>
    );
  }
  if (!order || (loading && !order)) return <DetailSkeleton />;

  const gift = isGift(order);
  const hidePrices = gift && !showPrices;
  const wa = orderWhatsApp(order);

  return (
    <div className="space-y-4">
      <BackLink />
      <AdminPage
        title={<span className="font-stencil text-[clamp(1.75rem,4.5vw,2.5rem)] leading-none">{order.number}</span>}
        actions={
          <>
            <OrderStamp status={order.status} className="self-center" />
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer strokeWidth={1.8} /> Print packing slip
            </Button>
          </>
        }
      >
        <p className="-mt-3 text-brown">
          Placed <span className="tabular">{formatDate(order.createdAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span> · {paymentMethodLabel(order)} · <span className="tabular font-semibold">{formatINR(order.total)}</span>
        </p>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          {/* Actions first in the DOM so they lead on a phone; they sit in the right column from lg. */}
          <div className="space-y-6 lg:col-start-2 lg:row-start-1">
            <OrderActions order={order} onUpdated={setData} />
            <CustomerPanel order={order} wa={wa} />
            <PaymentPanel order={order} />
          </div>

          <div className="space-y-6 lg:col-start-1 lg:row-start-1">
            <ItemsPanel order={order} />
            {gift ? (
              <Panel title={<span className="inline-flex items-center gap-2"><Gift className="size-[18px]" strokeWidth={1.8} /> Gift order</span>}>
                <blockquote className="max-w-[68ch] rounded-[12px] bg-kraft-light/60 px-4 py-3 whitespace-pre-line">{order.giftNote}</blockquote>
                <Checkbox className="mt-2" label="Show prices on the packing slip" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} />
                <p className="text-sm text-brown">{hidePrices ? "Prices are left off, so the recipient doesn't see what was paid." : "Prices will print. Turn this off for a gift."}</p>
              </Panel>
            ) : null}
            <ProgressPanel order={order} />
            <Panel title="Activity">
              {order.events.length ? <EventLog events={order.events} kind="order" /> : <p className="text-brown">Nothing has happened on this order yet.</p>}
            </Panel>
          </div>
        </div>
      </AdminPage>
      <PackingSlip order={order} hidePrices={hidePrices} />
    </div>
  );
}

function ItemsPanel({ order }: { order: Order }) {
  return (
    <Panel title="Items" flush>
      <ul className="divide-y divide-line px-5 pb-2">
        {order.items.map((i, idx) => (
          <li key={idx} className="flex gap-3 py-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={i.image} alt="" className="size-16 shrink-0 rounded-[10px] bg-kraft-light object-cover" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{i.name}</p>
              <p className="text-sm text-brown">{i.colour}{i.size ? ` · ${i.size}` : ""}</p>
              <div className="mt-1.5">
                <Badge tone={i.fulfilment === "READY" ? "ready" : "mto"}>{i.fulfilment === "READY" ? "Ready to ship" : "Made to order"}</Badge>
              </div>
              {i.personalization ? (
                <p className="mt-2 max-w-[68ch] rounded-[8px] bg-butter/40 px-3 py-1.5 text-[15px]"><span className="font-semibold">Personalization:</span> “{i.personalization}”</p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="tabular font-bold">{formatINR(i.unitPrice * i.qty)}</p>
              <p className="tabular text-sm text-brown">{i.qty} × {formatINR(i.unitPrice)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function CustomerPanel({ order: o, wa }: { order: Order; wa: { href: string; label: string } }) {
  const a = o.address;
  async function copy() {
    try {
      await navigator.clipboard.writeText(addressText(o));
      toast.success("Address copied.");
    } catch {
      toast.error("Couldn't copy. Select the address and copy it by hand.");
    }
  }
  return (
    <Panel title="Customer">
      <div className="space-y-4">
        <div>
          <p className="font-semibold">{o.contact.name}</p>
          <p className="text-[15px]"><a className="underline underline-offset-4" href={`tel:${o.contact.phone}`}>{o.contact.phone}</a></p>
          <p className="text-[15px] break-all"><a className="underline underline-offset-4" href={`mailto:${o.contact.email}`}>{o.contact.email}</a></p>
        </div>
        <Button asChild variant="tape" className="w-full">
          <a href={wa.href} target="_blank" rel="noopener noreferrer">
            <MessageCircle strokeWidth={1.8} /> {wa.label}
            <span className="sr-only"> (opens WhatsApp)</span>
          </a>
        </Button>
        <div>
          <p className="font-stencil mb-1.5 text-[11px] text-brown-soft">Ship to</p>
          <address className="rounded-[12px] bg-kraft-light/60 p-3 text-[15px] leading-snug not-italic">
            <span className="font-semibold">{a.name}</span>
            <br />
            {a.line1}
            {a.line2 ? <><br />{a.line2}</> : null}
            <br />
            <span className="font-stencil text-[13px]">{a.city}, {a.state} {a.postalCode}</span>
            <br />
            {countryName(a.country)}
            <br />
            <span className="tabular">{a.phone}</span>
          </address>
          <Button variant="ghost" className="mt-1 -ml-3" onClick={copy}>
            <Copy strokeWidth={1.8} /> Copy address
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function PaymentPanel({ order: o }: { order: Order }) {
  const rows: [string, string][] = [
    ["Subtotal", formatINR(o.subtotal)],
    ["Shipping", o.shipping ? formatINR(o.shipping) : "Free"],
    ...(o.codFee ? [["COD fee", formatINR(o.codFee)] as [string, string]] : []),
    ...(o.giftWrap ? [["Gift wrap", formatINR(o.giftWrap)] as [string, string]] : []),
    ...(o.discount ? [["Discount", `-${formatINR(o.discount)}`] as [string, string]] : []),
  ];
  return (
    <Panel title="Payment and delivery">
      <dl className="space-y-1.5 text-[15px]">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <dt className="text-brown">{k}</dt>
            <dd className="tabular">{v}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-bold">
          <dt>Total</dt>
          <dd className="tabular">{formatINR(o.total)}</dd>
        </div>
      </dl>
      <dl className="mt-4 space-y-1.5 border-t border-line pt-4 text-[15px]">
        <div className="flex justify-between gap-4"><dt className="text-brown">Method</dt><dd>{paymentMethodLabel(o)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-brown">Payment</dt><dd className="font-semibold">{PAYMENT_STATUS_LABEL[o.paymentStatus]}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-brown">Dispatch by</dt><dd className="tabular">{formatDate(o.estimatedDispatch)}</dd></div>
        {o.courier ? <div className="flex justify-between gap-4"><dt className="text-brown">Courier</dt><dd>{o.courier}</dd></div> : null}
        {o.awb ? <div className="flex justify-between gap-4"><dt className="text-brown">AWB</dt><dd className="font-stencil text-[13px]">{o.awb}</dd></div> : null}
      </dl>
    </Panel>
  );
}

function ProgressPanel({ order }: { order: Order }) {
  if (ENDED_STATUSES.includes(order.status)) return null;
  const flow = ORDER_FLOW.filter((s) => !s.mtoOnly || hasMadeToOrder(order));
  const steps: TimelineStep[] = flow.map((s) => {
    const e = [...order.events].reverse().find((x) => x.status === s.key);
    return { label: s.label, at: e?.at, note: e?.note };
  });
  const current = flow.findIndex((s) => s.key === order.status);
  return (
    <Panel title="Where it is">
      <Timeline steps={steps} current={current} waiting={order.status === "PLACED" && order.paymentMethod === "COD"} />
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading order" className="space-y-4">
      <Skeleton className="h-11 w-32" />
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6 lg:col-start-2 lg:row-start-1">
          <Skeleton className="h-64 rounded-ticket" />
          <Skeleton className="h-72 rounded-ticket" />
        </div>
        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
          <Skeleton className="h-56 rounded-ticket" />
          <Skeleton className="h-64 rounded-ticket" />
        </div>
      </div>
    </div>
  );
}
