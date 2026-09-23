"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
import { AccordionItem, Accordion } from "@/components/ui/Tabs";
import { CustomStamp } from "@/components/ui/StatusStamp";
import { EventLog, Timeline, type TimelineStep } from "@/components/ui/Timeline";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import { getProduct, listCategories } from "@/lib/api/catalog";
import { getMine, liveQuote } from "@/lib/api/custom";
import { useApi } from "@/lib/api/useApi";
import { formatDate } from "@/lib/format";
import { CUSTOM_FLOW, CUSTOM_STATUS, customFlowIndex } from "@/lib/status";
import type { CustomRequest, CustomStatus } from "@/lib/types";
import { acceptedQuote, isNotFound } from "./helpers";
import { MessageThread } from "./MessageThread";
import { QuoteCard } from "./QuoteCard";
import { RequestDetails } from "./RequestDetails";
import { AcceptedPanel, ApprovalPanel, BalancePanel, CounterSentPanel, DepositPanel, EndedPanel, PhotoGallery, ProgressPanel, ShippingPanel, WaitingForQuotePanel } from "./StatusPanels";

/** States where the next move is the customer's, so the timeline thread ends in a loose curl. */
const WAITING_ON_YOU: CustomStatus[] = ["QUOTED", "DEPOSIT_PENDING", "AWAITING_APPROVAL", "BALANCE_PENDING"];
const ENDED: CustomStatus[] = ["DECLINED", "CANCELLED", "EXPIRED"];
const PHOTO_STATES: CustomStatus[] = ["IN_QUEUE", "IN_PROGRESS", "AWAITING_APPROVAL", "BALANCE_PENDING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CLOSED"];

/** Flow key → the event statuses that mark reaching it. */
const STEP_EVENTS: Partial<Record<CustomStatus, string[]>> = {
  REQUESTED: ["REQUESTED"],
  QUOTED: ["QUOTED"],
  ACCEPTED: ["ACCEPTED"],
  IN_PROGRESS: ["IN_QUEUE", "IN_PROGRESS"],
  AWAITING_APPROVAL: ["AWAITING_APPROVAL"],
  BALANCE_PENDING: ["BALANCE_PENDING"],
  SHIPPED: ["SHIPPED"],
  DELIVERED: ["DELIVERED"],
};

function buildSteps(r: CustomRequest, current: number): TimelineStep[] {
  return CUSTOM_FLOW.map((s, i) => {
    const kinds = STEP_EVENTS[s.key];
    const hit = i <= current && kinds ? r.events.find((e) => kinds.includes(e.status)) : undefined;
    return { label: s.label, at: hit?.at };
  });
}

export function WorkOrderDetail({ number }: { number: string }) {
  const { data: fetched, error, loading, reload, setData } = useApi(() => getMine(number), `wo-${number}`);
  // useApi keeps the previous data while a new key loads; never show another work order in the meantime.
  const r = fetched?.number === number ? fetched : undefined;
  const cats = useApi(listCategories, "categories");
  const base = useApi(() => getProduct(r!.baseProductSlug!), `wo-base-${r?.baseProductSlug ?? ""}`, !!r?.baseProductSlug && r.kind === "CUSTOMIZE");
  const [focusDeposit, setFocusDeposit] = useState(false);

  /** After any mutation: show the response straight away, then re-fetch to confirm. */
  function changed(next?: CustomRequest, opts?: { focusPanel?: boolean }) {
    if (next) setData(next);
    if (opts?.focusPanel) setFocusDeposit(true);
    reload();
  }

  if (!r) {
    if (error) {
      return isNotFound(error) ? (
        <EmptyState
          title="We couldn't find that work order"
          action={
            <Button asChild size="lg">
              <Link href="/account/custom">See your work orders</Link>
            </Button>
          }
        >
          Check the number, or make sure you&apos;re logged in to the account you sent it from.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          <BackLink />
          <ErrorNote onRetry={reload}>{error.message || "We couldn't load this work order."}</ErrorNote>
        </div>
      );
    }
    return loading || !error ? <DetailSkeleton /> : null;
  }

  const meta = CUSTOM_STATUS[r.status];
  const ended = ENDED.includes(r.status);
  const current = r.status === "DELIVERED" || r.status === "CLOSED" ? CUSTOM_FLOW.length : customFlowIndex(r.status);
  const q = liveQuote(r);
  const acc = acceptedQuote(r);

  return (
    <div className="space-y-6">
      <BackLink />
      {error ? <ErrorNote onRetry={reload}>We couldn&apos;t refresh this work order. What you see may be out of date.</ErrorNote> : null}

      <Ticket tone="kraft" head={["Work order", r.number]}>
        <div className="flex flex-col gap-4 px-1 pb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h1 className="font-display text-[clamp(2rem,5vw,3.25rem)] leading-[1.02] text-balance [overflow-wrap:anywhere]">{r.title}</h1>
            <p className="mt-3 max-w-[62ch] text-[15px] leading-relaxed">{meta.hint}</p>
            <p className="tabular mt-2 text-sm text-brown">
              Sent {formatDate(r.createdAt, { day: "numeric", month: "short", year: "numeric" })}
              {r.neededBy ? <> · Needed by {formatDate(r.neededBy, { day: "numeric", month: "short", year: "numeric" })}</> : null}
            </p>
          </div>
          <CustomStamp status={r.status} className="shrink-0 self-start sm:mt-1" />
        </div>
      </Ticket>

      {/* Mobile: action panel first. Desktop: details left, action + conversation right. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] xl:gap-8">
        <div className="space-y-6 lg:order-2">
          <div className="space-y-6">
            {r.status === "QUOTED" && q ? <QuoteCard key={q.id} r={r} quote={q} onChange={changed} /> : null}
            {r.status === "QUOTED" && !q ? <WaitingForQuotePanel r={r} /> : null}
            {(r.status === "REQUESTED" || r.status === "UNDER_REVIEW") && <WaitingForQuotePanel r={r} />}
            {r.status === "COUNTERED" && q ? <CounterSentPanel r={r} quote={q} onChange={changed} /> : null}
            {r.status === "ACCEPTED" && <AcceptedPanel r={r} />}
            {r.status === "DEPOSIT_PENDING" && acc ? <DepositPanel r={r} quote={acc} onChange={changed} focusOnMount={focusDeposit} /> : null}
            {(r.status === "IN_QUEUE" || r.status === "IN_PROGRESS") && <ProgressPanel r={r} />}
            {r.status === "AWAITING_APPROVAL" && <ApprovalPanel r={r} quote={acc} onChange={changed} />}
            {r.status === "BALANCE_PENDING" && acc ? <BalancePanel r={r} quote={acc} onChange={changed} /> : null}
            {(r.status === "READY_TO_SHIP" || r.status === "SHIPPED" || r.status === "DELIVERED" || r.status === "CLOSED") && <ShippingPanel r={r} />}
            {ended && <EndedPanel r={r} />}
          </div>
          {PHOTO_STATES.includes(r.status) ? <PhotoGallery r={r} /> : null}
          <MessageThread r={r} onChange={changed} />
        </div>

        <div className="space-y-6 lg:order-1">
          <RequestDetails r={r} cats={cats.data} baseName={base.data?.name} />

          <Ticket tone="paper" role="region" aria-labelledby="timeline-title" head={["Progress", meta.label]}>
            <div className="space-y-4 px-1 pb-2">
              <h2 id="timeline-title" className="font-display text-[1.75rem] leading-[1.05]">
                Where it stands
              </h2>
              {ended ? (
                <p className="text-[15px] text-brown">This work order ended before the piece was made. Every step is in the activity log below.</p>
              ) : (
                <Timeline steps={buildSteps(r, current)} current={current} waiting={WAITING_ON_YOU.includes(r.status)} />
              )}
              <Accordion type="single" collapsible>
                <AccordionItem value="log" title="Activity log">
                  <EventLog events={r.events} kind="custom" />
                </AccordionItem>
              </Accordion>
            </div>
          </Ticket>
        </div>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/account/custom" className="press inline-flex min-h-11 items-center gap-1.5 font-semibold text-brown [@media(hover:hover)_and_(pointer:fine)]:hover:text-cocoa">
      <ArrowLeft aria-hidden strokeWidth={1.8} className="size-4" />
      All work orders
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading your work order" className="space-y-6">
      <Skeleton className="h-6 w-36" />
      <Skeleton className="h-44 w-full rounded-ticket" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
        <Skeleton className="h-96 w-full rounded-ticket lg:order-2" />
        <Skeleton className="h-96 w-full rounded-ticket lg:order-1" />
      </div>
    </div>
  );
}
