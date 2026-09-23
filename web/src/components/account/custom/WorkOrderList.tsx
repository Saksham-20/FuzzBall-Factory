"use client";

import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
import { CustomStamp } from "@/components/ui/StatusStamp";
import { EmptyState, ErrorNote, PageHeader, Skeleton } from "@/components/ui/misc";
import { listCategories } from "@/lib/api/catalog";
import { listMine } from "@/lib/api/custom";
import { useApi } from "@/lib/api/useApi";
import { formatDate } from "@/lib/format";
import type { Category, CustomRequest } from "@/lib/types";
import { budgetLabel, categoryName, groupOf, nextStepLine, type Group } from "./helpers";

const GROUPS: { key: Group; title: string; blurb: string }[] = [
  { key: "needs", title: "Needs you", blurb: "These are waiting on a decision or a payment from you." },
  { key: "progress", title: "In progress", blurb: "Nothing to do here. We'll tell you when that changes." },
  { key: "closed", title: "Closed", blurb: "Finished, declined, cancelled or expired." },
];

export function WorkOrderList() {
  const { data, error, loading, reload } = useApi(listMine, "custom-mine");
  const cats = useApi(listCategories, "categories");

  return (
    <div>
      <PageHeader title="Work orders" className="mb-8">
        <Button asChild>
          <Link href="/custom">
            <Plus aria-hidden strokeWidth={1.8} />
            Start a work order
          </Link>
        </Button>
      </PageHeader>

      {error ? (
        <ErrorNote onRetry={reload}>{error.message || "We couldn't load your work orders."}</ErrorNote>
      ) : !data && loading ? (
        <ListSkeleton />
      ) : data && data.length === 0 ? (
        <EmptyState
          title="No work orders yet"
          action={
            <Button asChild size="lg">
              <Link href="/custom">Start a work order</Link>
            </Button>
          }
        >
          Describe a piece you have in mind, or change one from the shelf. We reply with a quote you can accept, counter or pass on.
        </EmptyState>
      ) : data ? (
        <div className="space-y-10">
          {GROUPS.map((g) => {
            const rows = data.filter((r) => groupOf(r) === g.key);
            if (!rows.length) return null;
            return (
              <section key={g.key} aria-labelledby={`grp-${g.key}`}>
                <h2 id={`grp-${g.key}`} className="font-display text-[1.75rem] leading-none">
                  {g.title} <span className="font-stencil tabular text-base text-brown-soft">{rows.length}</span>
                </h2>
                <p className="mt-2 mb-4 text-[15px] text-brown">{g.blurb}</p>
                <ul className="space-y-3">
                  {rows.map((r) => (
                    <li key={r.number}>
                      <Row r={r} cats={cats.data} urgent={g.key === "needs"} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Row({ r, cats, urgent }: { r: CustomRequest; cats?: Category[]; urgent: boolean }) {
  const next = nextStepLine(r);
  return (
    <Link
      href={`/account/custom/${r.number}`}
      className="group block rounded-ticket outline-offset-4"
    >
      <Ticket tone={urgent ? "kraft" : "paper"} head={[r.number, `Sent ${formatDate(r.createdAt)}`]} className="press transition-[transform,box-shadow] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:shadow-lift">
        <div className="flex flex-col gap-3 px-1 pb-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h3 className="text-lg leading-snug font-bold [overflow-wrap:anywhere]">{r.title}</h3>
            <p className="mt-1 text-sm text-brown">
              {categoryName(r.category, cats)} <span aria-hidden>·</span> Budget <span className="tabular">{budgetLabel(r)}</span>
            </p>
            {next ? (
              <p className="mt-2.5 flex items-center gap-1.5 font-semibold">
                {next}
                <ArrowRight aria-hidden strokeWidth={1.8} className="size-4 shrink-0 transition-transform duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5" />
              </p>
            ) : null}
          </div>
          <CustomStamp status={r.status} className="shrink-0 self-start sm:mt-1 sm:self-auto" />
        </div>
      </Ticket>
    </Link>
  );
}

function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading your work orders" className="space-y-3">
      <Skeleton className="h-8 w-40" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-[132px] w-full rounded-ticket" />
      ))}
    </div>
  );
}
