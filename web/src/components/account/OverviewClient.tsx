"use client";

import Link from "next/link";
import { ArrowRight, MessageCircle, PackageSearch, Scissors, ShoppingBag } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { AccountHeading } from "@/components/account/AccountShell";
import { OrderThumbs } from "@/components/account/OrderThumbs";
import { compactWindow, orderProgress } from "@/components/account/orderSteps";
import { Button } from "@/components/ui/Button";
import { ErrorNote, Skeleton } from "@/components/ui/misc";
import { OrderStamp } from "@/components/ui/StatusStamp";
import { Timeline } from "@/components/ui/Timeline";
import * as orders from "@/lib/api/orders";
import * as custom from "@/lib/api/custom";
import { useApi } from "@/lib/api/useApi";
import { useAuth } from "@/lib/state/AuthContext";
import { formatDate, formatINR } from "@/lib/format";
import { CUSTOM_STATUS } from "@/lib/status";
import { waGeneral } from "@/lib/whatsapp";
import type { CustomRequest, Order } from "@/lib/types";

interface Action {
  number: string;
  title: string;
  label: string;
  detail: string;
}

function daysLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/** The work orders where the next move is the customer's. */
function actionsFor(requests: CustomRequest[]): Action[] {
  const out: Action[] = [];
  for (const r of requests) {
    const q = custom.liveQuote(r);
    const base = { number: r.number, title: r.title, label: CUSTOM_STATUS[r.status].label };
    if (r.status === "QUOTED" && q && !custom.quoteExpired(q)) {
      const d = daysLeft(q.validUntil);
      const when = d <= 0 ? "expires today" : d === 1 ? "expires tomorrow" : `expires in ${d} days`;
      out.push({ ...base, detail: `${formatINR(q.price)}, ${when}` });
    } else if (r.status === "DEPOSIT_PENDING" && q) {
      out.push({ ...base, detail: `${formatINR(custom.depositAmount(q))} advance starts your piece` });
    } else if (r.status === "AWAITING_APPROVAL") {
      out.push({ ...base, detail: "Your finished piece is ready for a look" });
    } else if (r.status === "BALANCE_PENDING" && q) {
      out.push({ ...base, detail: `${formatINR(custom.balanceAmount(q))} balance, then we ship` });
    }
  }
  return out;
}

const QUICK = [
  { href: "/track", label: "Track an order", icon: PackageSearch },
  { href: "/custom", label: "Start a work order", icon: Scissors },
  { href: "/shop", label: "Keep shopping", icon: ShoppingBag },
] as const;

export function OverviewClient() {
  const { user } = useAuth();
  const ords = useApi(orders.listMyOrders, "my-orders");
  const wos = useApi(custom.listMine, "my-custom");
  const first = user?.name.split(" ")[0] ?? "there";
  const latest = ords.data?.[0];

  return (
    <div>
      <AccountHeading title={`Hi, ${first}.`} />
      <p className="mt-3 max-w-[60ch] text-brown">Here&apos;s what&apos;s on the shelf: your latest order and anything that needs a decision from you.</p>

      <div className="mt-10 grid gap-10 md:grid-cols-2 md:gap-8">
        <section aria-labelledby="latest-h">
          <h2 id="latest-h" className="font-display text-[2rem]">
            Latest order
          </h2>
          <div className="mt-4">
            {ords.loading && !ords.data ? (
              <Skeleton className="h-80 rounded-ticket" />
            ) : ords.error ? (
              <ErrorNote onRetry={ords.reload}>{ords.error.message}</ErrorNote>
            ) : !latest ? (
              <div className="rounded-ticket border border-dashed border-line-strong p-6">
                <p className="font-semibold">No orders yet.</p>
                <p className="mt-1 text-brown">When you place one, its progress shows up here.</p>
                <Button asChild variant="secondary" className="mt-4">
                  <Link href="/shop">Browse the shop</Link>
                </Button>
              </div>
            ) : (
              <LatestOrder order={latest} />
            )}
          </div>
        </section>

        <section aria-labelledby="action-h">
          <h2 id="action-h" className="font-display text-[2rem]">
            Waiting on you
          </h2>
          <div className="mt-4" aria-live="polite">
            {wos.loading && !wos.data ? (
              <Skeleton className="h-40 rounded-ticket" />
            ) : wos.error ? (
              <ErrorNote onRetry={wos.reload}>{wos.error.message}</ErrorNote>
            ) : (
              <ActionList requests={wos.data ?? []} />
            )}
          </div>
        </section>
      </div>

      <section aria-labelledby="quick-h" className="mt-12">
        <h2 id="quick-h" className="font-display text-[2rem]">
          Quick links
        </h2>
        <ul className="mt-4 flex flex-wrap gap-3">
          {QUICK.map((q) => (
            <li key={q.href}>
              <Button asChild variant="secondary">
                <Link href={q.href}>
                  <q.icon strokeWidth={1.8} aria-hidden />
                  {q.label}
                </Link>
              </Button>
            </li>
          ))}
          <li>
            <Button asChild variant="secondary">
              <a href={waGeneral()} target="_blank" rel="noopener noreferrer">
                <MessageCircle strokeWidth={1.8} aria-hidden />
                Ask on WhatsApp
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </Button>
          </li>
        </ul>
      </section>
    </div>
  );
}

function LatestOrder({ order }: { order: Order }) {
  const p = orderProgress(order);
  const w = compactWindow(p);
  const pieces = order.items.reduce((s, i) => s + i.qty, 0);
  return (
    <Ticket head={[order.number, formatDate(order.createdAt, { day: "numeric", month: "short", year: "numeric" })]} className="px-4 pb-4">
      <div className="flex items-center justify-between gap-3">
        <OrderThumbs items={order.items} />
        <OrderStamp status={order.status} />
      </div>
      <p className="tabular mt-4 font-semibold">
        {formatINR(order.total)}
        <span className="font-normal text-brown"> · {pieces} {pieces === 1 ? "piece" : "pieces"}</span>
      </p>
      <Timeline className="mt-5" steps={w.steps} current={w.current} waiting={order.status === "PENDING_PAYMENT"} />
      <Link href={`/account/orders/${order.number}`} className="press mt-4 inline-flex min-h-11 items-center gap-2 font-semibold underline">
        View order
        <ArrowRight className="size-4" strokeWidth={2} aria-hidden />
      </Link>
    </Ticket>
  );
}

function ActionList({ requests }: { requests: CustomRequest[] }) {
  const actions = actionsFor(requests);
  if (actions.length === 0) {
    return (
      <div className="rounded-ticket border border-dashed border-line-strong p-6">
        <p className="font-semibold">Nothing waiting on you.</p>
        <p className="mt-1 text-brown">
          {requests.length === 0 ? "Have an idea or want a piece changed? Send a work order and we'll quote it." : "Quotes, deposits and approvals will show up here when they need you."}
        </p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href={requests.length === 0 ? "/custom" : "/account/custom"}>{requests.length === 0 ? "Start a work order" : "See your work orders"}</Link>
        </Button>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-line rounded-ticket bg-paper shadow-ticket">
      {actions.map((a) => (
        <li key={a.number}>
          <Link href={`/account/custom/${a.number}`} className="press group flex min-h-16 items-center justify-between gap-4 px-4 py-3.5">
            <span className="min-w-0">
              <span className="font-stencil tabular block text-[11px] text-brown-soft">
                {a.number} · {a.label}
              </span>
              <span className="mt-1 block truncate font-semibold">{a.title}</span>
              <span className="tabular block text-[15px] text-brown">{a.detail}</span>
            </span>
            <ArrowRight className="size-5 shrink-0 text-brown transition-transform duration-150 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5" strokeWidth={1.8} aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
