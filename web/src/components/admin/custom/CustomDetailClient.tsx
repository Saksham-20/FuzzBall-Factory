"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronLeft, Clock, Minus, MessageCircle, TriangleAlert } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import { CustomStamp } from "@/components/ui/StatusStamp";
import { EventLog, Timeline, type TimelineStep } from "@/components/ui/Timeline";
import { getAdminCustom } from "@/lib/api/admin";
import { balanceAmount, depositAmount } from "@/lib/api/custom";
import { useApi } from "@/lib/api/useApi";
import { formatDate, formatINR } from "@/lib/format";
import { ApiError } from "@/lib/mock/db";
import { CUSTOM_FLOW, COUNTRIES, customFlowIndex } from "@/lib/status";
import { cn } from "@/lib/cn";
import type { CustomRequest } from "@/lib/types";
import { CustomActions } from "./CustomActions";
import { Due } from "./Due";
import { QuoteBuilder } from "./QuoteBuilder";
import { Thread } from "./Thread";
import { workOrderWhatsApp } from "./wa";
import { DECLINE_TEMPLATES, OPEN_FOR_QUOTE, ageLabel, budgetLabel, licensedMention, moneyQuote, moverOf, paymentStates, type PayState } from "./workflow";

function BackLink() {
  return (
    <Link href="/admin/custom" className="press -ml-2 inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[15px] font-semibold text-brown underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">
      <ChevronLeft className="size-[18px]" strokeWidth={1.8} /> All work orders
    </Link>
  );
}

export function CustomDetailClient({ number }: { number: string }) {
  const { data: r, error, reload, setData } = useApi(() => getAdminCustom(number), `wo:${number}`);
  // The builder is open by default when a quote is the next move, and opens on demand after a counter.
  const [builderRequested, setBuilderRequested] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineInitial, setDeclineInitial] = useState<string>();

  if (error && !r) {
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <div className="space-y-4">
        <BackLink />
        {missing ? (
          <Panel>
            <EmptyState title="No such work order" action={<Button asChild variant="secondary"><Link href="/admin/custom">Back to work orders</Link></Button>}>
              We couldn&apos;t find a work order numbered {number}. Check the number, or open it from the board.
            </EmptyState>
          </Panel>
        ) : (
          <ErrorNote onRetry={reload}>{error.message || "We couldn't load this work order."}</ErrorNote>
        )}
      </div>
    );
  }
  if (!r) return <DetailSkeleton />;

  const showBuilder = OPEN_FOR_QUOTE.includes(r.status) && (r.status !== "COUNTERED" || builderRequested);
  const openBuilder = () => {
    setBuilderRequested(true);
    // Wait a frame so the builder has mounted, then bring it into view and focus its first field.
    requestAnimationFrame(() => {
      const el = document.getElementById("quote-builder");
      el?.scrollIntoView({ block: "start" });
      el?.querySelector("input")?.focus({ preventScroll: true });
    });
  };

  return (
    <div className="space-y-4">
      <BackLink />
      <AdminPage
        title={<span className="font-stencil text-[clamp(1.75rem,4.5vw,2.5rem)] leading-none">{r.number}</span>}
        actions={<CustomStamp status={r.status} className="self-center" />}
      >
        <div className="-mt-3">
          <p className="text-lg font-semibold">{r.title}</p>
          <p className="text-brown">{r.customerName} · {ageLabel(r.createdAt).toLowerCase()}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="lg:col-start-2 lg:row-start-1">
            <CustomActions
              request={r}
              onUpdated={setData}
              onRefresh={reload}
              openBuilder={openBuilder}
              declineOpen={declineOpen}
              setDeclineOpen={setDeclineOpen}
              declineInitial={declineInitial}
            />
          </div>

          <div className="space-y-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <RequestPanel
              r={r}
              onDeclineForLicensed={() => { setDeclineInitial(DECLINE_TEMPLATES[0].label); setDeclineOpen(true); }}
            />
            {showBuilder ? <QuoteBuilder focusOnOpen={builderRequested} request={r} onSent={(next) => { setBuilderRequested(false); setData(next); }} /> : null}
            <Thread request={r} onUpdated={setData} />
            <ProgressPanel r={r} />
            <Panel title="Activity">
              {r.events.length ? <EventLog events={r.events} kind="custom" /> : <p className="text-brown">Nothing has happened on this work order yet.</p>}
            </Panel>
          </div>

          <div className="space-y-6 lg:col-start-2 lg:row-start-2">
            <PaymentsPanel r={r} />
            <CustomerPanel r={r} />
          </div>
        </div>
      </AdminPage>
    </div>
  );
}

function RequestPanel({ r, onDeclineForLicensed }: { r: CustomRequest; onDeclineForLicensed: () => void }) {
  const mention = licensedMention(r);
  const canDecline = OPEN_FOR_QUOTE.includes(r.status);
  const specs: [string, string | undefined][] = [
    ["Category", r.category],
    ["Colours", r.colours.join(", ") || undefined],
    ["Size", r.size],
    ["Quantity", String(r.quantity)],
    ["Occasion", r.occasion],
    ["Personalization", r.personalization],
    ["Budget", budgetLabel(r)],
    ["Ships to", `${COUNTRIES.find((c) => c.code === r.country)?.name ?? r.country}${r.postalCode ? `, ${r.postalCode}` : ""}`],
  ];
  return (
    <Panel title="The request">
      <div className="space-y-5">
        {mention && canDecline ? (
          <div role="note" className="flex gap-3 rounded-[12px] bg-warn-wash p-3 text-warn">
            <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0" strokeWidth={1.8} />
            <div className="space-y-2">
              <p className="max-w-[60ch] font-medium">This mentions “{mention}”, which may be a licensed character. We only make original designs. Have a look at the references before you quote. Nothing is declined automatically.</p>
              <button type="button" onClick={onDeclineForLicensed} className="press min-h-11 font-semibold underline underline-offset-4">Decline with the licensed-character note</button>
            </div>
          </div>
        ) : null}

        <div>
          {r.kind === "CUSTOMIZE" ? <p className="mb-1 text-sm font-semibold text-brown">Customising an existing piece{r.baseProductSlug ? `: ${r.baseProductSlug.replaceAll("-", " ")}` : ""}</p> : <p className="mb-1 text-sm font-semibold text-brown">A new idea</p>}
          <p className="max-w-[68ch] leading-relaxed whitespace-pre-line">{r.description}</p>
        </div>

        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {specs.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}>
              <dt className="text-sm text-brown-soft">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
          <div>
            <dt className="text-sm text-brown-soft">Needed by</dt>
            <dd className="font-medium"><Due r={r} /></dd>
          </div>
        </dl>

        <div>
          <h3 className="mb-2 text-sm font-semibold">Reference images</h3>
          {r.references.length ? (
            <ul className="flex flex-wrap gap-3">
              {r.references.map((src, i) => (
                <li key={i}>
                  <a href={src} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-[12px] bg-kraft-light">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Reference image ${i + 1} for ${r.title}`} className="size-28 object-cover sm:size-36" />
                    <span className="sr-only">Open full size in a new tab</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-brown">No reference images. Ask for some in the thread if the description isn&apos;t enough.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

const PAY_LABEL: Record<PayState, string> = { later: "Not yet due", due: "Due", paid: "Paid", none: "Not applicable" };

function PayChip({ state }: { state: PayState }) {
  const Icon = state === "paid" ? Check : state === "due" ? Clock : Minus;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-semibold", state === "paid" && "text-ok", state === "due" && "text-rose-deep", (state === "later" || state === "none") && "text-brown-soft")}>
      <Icon aria-hidden className="size-4" strokeWidth={2} />
      {PAY_LABEL[state]}
    </span>
  );
}

function PaymentsPanel({ r }: { r: CustomRequest }) {
  const q = moneyQuote(r);
  const { deposit, balance } = paymentStates(r);
  return (
    <Panel title="Payments">
      {q ? (
        <dl className="space-y-2.5 text-[15px]">
          <div className="flex items-baseline justify-between gap-4 text-base font-bold">
            <dt>{r.status === "ACCEPTED" || deposit === "paid" || deposit === "due" ? "Agreed price" : "Quoted price"}</dt>
            <dd className="tabular">{formatINR(q.status === "COUNTERED" && q.counter ? q.counter.amount : q.price)}</dd>
          </div>
          {(() => {
            const price = q.status === "COUNTERED" && q.counter ? q.counter.amount : q.price;
            const s = { price, depositPct: q.depositPct };
            return (
              <>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-brown">Deposit ({q.depositPct}%) <span className="tabular font-semibold text-cocoa">{formatINR(depositAmount(s))}</span></dt>
                  <dd><PayChip state={deposit} /></dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-brown">Balance <span className="tabular font-semibold text-cocoa">{formatINR(balanceAmount(s))}</span></dt>
                  <dd><PayChip state={balance} /></dd>
                </div>
              </>
            );
          })()}
          {q.status === "SENT" ? <p className="border-t border-line pt-2 text-sm text-brown">Quote valid until <span className="tabular">{formatDate(q.validUntil)}</span>.</p> : null}
          {q.status === "COUNTERED" && q.counter ? <p className="border-t border-line pt-2 text-sm text-brown">You quoted {formatINR(q.price)}. This is their counter.</p> : null}
        </dl>
      ) : (
        <p className="text-brown">No quote yet, so no money is due. The deposit and balance appear here once you send one.</p>
      )}
    </Panel>
  );
}

function CustomerPanel({ r }: { r: CustomRequest }) {
  const wa = workOrderWhatsApp(r);
  return (
    <Panel title="Customer">
      <div className="space-y-4">
        <div>
          <p className="font-semibold">{r.customerName}</p>
          <p className="text-[15px]"><a className="tabular underline underline-offset-4" href={`tel:${r.customerPhone}`}>{r.customerPhone}</a></p>
          <p className="mt-1 text-sm text-brown">{moverOf(r.status) === "customer" ? "Waiting on them right now." : "The next move is yours."}</p>
        </div>
        <Button asChild variant="tape" className="w-full">
          <a href={wa.href} target="_blank" rel="noopener noreferrer">
            <MessageCircle strokeWidth={1.8} /> {wa.label}
            <span className="sr-only"> (opens WhatsApp)</span>
          </a>
        </Button>
      </div>
    </Panel>
  );
}

function ProgressPanel({ r }: { r: CustomRequest }) {
  if (["DECLINED", "EXPIRED", "CANCELLED"].includes(r.status)) return null;
  const steps: TimelineStep[] = CUSTOM_FLOW.map((s) => {
    const e = [...r.events].reverse().find((x) => x.status === s.key);
    return { label: s.label, at: e?.at, note: e?.note, photo: e?.photo };
  });
  return (
    <Panel title="Where it is">
      <Timeline steps={steps} current={customFlowIndex(r.status)} waiting={moverOf(r.status) === "customer"} />
    </Panel>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading work order" className="space-y-4">
      <Skeleton className="h-11 w-40" />
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6 lg:col-start-2 lg:row-start-1">
          <Skeleton className="h-64 rounded-ticket" />
        </div>
        <div className="space-y-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <Skeleton className="h-72 rounded-ticket" />
          <Skeleton className="h-64 rounded-ticket" />
        </div>
      </div>
    </div>
  );
}
