"use client";

import Link from "next/link";
import { useState } from "react";
import { CustomStamp } from "@/components/ui/StatusStamp";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CustomRequest } from "@/lib/types";
import { rowStampClass } from "../orders/helpers";
import { Due } from "./Due";
import { COLUMNS, MOVER_TEXT, ageLabel, budgetLabel, laneSort, quotePrice, type Column } from "./workflow";

export const workOrderHref = (r: Pick<CustomRequest, "number">) => `/admin/custom/${encodeURIComponent(r.number)}`;

const CLOSED_VISIBLE = 5;

/** Kanban. Columns scroll sideways (a phone shows one and a peek of the next). Moves happen on the detail page. */
export function CustomBoard({ rows }: { rows: CustomRequest[] }) {
  return (
    <div
      role="region"
      aria-label="Work order board. Scroll sideways for more columns."
      tabIndex={0}
      data-lenis-prevent
      className="-mx-4 flex snap-x snap-proximity items-start gap-4 overflow-x-auto px-4 pb-4 scroll-pl-4 md:mx-0 md:px-0"
    >
      {COLUMNS.map((c) => (
        <Lane key={c.id} column={c} cards={rows.filter((r) => c.statuses.includes(r.status)).sort(laneSort)} />
      ))}
    </div>
  );
}

function Lane({ column: c, cards }: { column: Column; cards: CustomRequest[] }) {
  const [all, setAll] = useState(false);
  const capped = c.id === "closed" && !all && cards.length > CLOSED_VISIBLE;
  const shown = capped ? cards.slice(0, CLOSED_VISIBLE) : cards;
  const empty = cards.length === 0;
  const titleId = `lane-${c.id}`;
  return (
    <section aria-labelledby={titleId} className={cn("shrink-0 snap-start", empty ? "w-[184px]" : "w-[280px]")}>
      <header className="mb-3 border-b-2 border-cocoa pb-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id={titleId} className="text-[15px] font-bold">{c.label}</h2>
          <span className="tabular text-sm font-semibold text-brown"><span className="sr-only">Cards: </span>{cards.length}</span>
        </div>
        <p className="text-xs text-brown-soft">{MOVER_TEXT[c.mover]}</p>
      </header>
      {empty ? (
        <p className="rounded-[12px] border-[1.5px] border-dashed border-line-strong px-3 py-6 text-center text-sm text-brown-soft">Nothing here</p>
      ) : (
        <ol className="space-y-3">
          {shown.map((r) => (
            <li key={r.number}>
              <Card r={r} showStamp={c.statuses.length > 1} />
            </li>
          ))}
        </ol>
      )}
      {capped ? (
        <button type="button" onClick={() => setAll(true)} className="press mt-2 min-h-11 w-full rounded-full text-sm font-semibold underline underline-offset-4">
          Show {cards.length - CLOSED_VISIBLE} more
        </button>
      ) : null}
    </section>
  );
}

function Card({ r, showStamp }: { r: CustomRequest; showStamp: boolean }) {
  const price = quotePrice(r);
  return (
    <Link href={workOrderHref(r)} className={cn("press block rounded-ticket bg-paper p-3.5 shadow-ticket transition-shadow duration-150", "[@media(hover:hover)_and_(pointer:fine)]:hover:shadow-lift")}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-stencil text-[13px]">{r.number}</span>
        <span className="text-xs text-brown-soft">{ageLabel(r.createdAt)}</span>
      </span>
      <span className="mt-1 line-clamp-2 block font-semibold leading-snug">{r.title}</span>
      <span className="block text-sm text-brown">{r.customerName}</span>
      <span className="mt-2 block space-y-0.5 text-sm">
        <span className="block"><span className="text-brown-soft">Budget </span><span className="tabular font-semibold">{budgetLabel(r)}</span></span>
        {price ? <span className="block"><span className="text-brown-soft">Quote </span><span className="tabular font-semibold">{formatINR(price)}</span></span> : null}
        {r.neededBy ? <span className="block"><span className="text-brown-soft">Needed by </span><Due r={r} /></span> : null}
      </span>
      {showStamp ? <CustomStamp status={r.status} className={cn("mt-3", rowStampClass(r.status))} /> : null}
    </Link>
  );
}
