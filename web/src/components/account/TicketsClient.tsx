"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AccountHeading } from "@/components/account/AccountShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import { listMyTickets } from "@/lib/api/support";
import { useApi } from "@/lib/api/useApi";
import { formatDate } from "@/lib/format";
import { CUSTOMER_STATUS_LABEL, KIND_LABEL } from "@/lib/support";
import type { TicketStatus } from "@/lib/types";

const TONE: Record<TicketStatus, "mto" | "ooak" | "ready" | "sold"> = { OPEN: "mto", WAITING_CUSTOMER: "ooak", RESOLVED: "ready", CLOSED: "sold" };

export function TicketsClient() {
  const { data, error, loading, reload } = useApi(listMyTickets, "my-tickets");
  return (
    <div>
      <AccountHeading title="Help requests">
        <Button asChild variant="secondary">
          <Link href="/contact">New request</Link>
        </Button>
      </AccountHeading>
      <div className="mt-8" aria-live="polite">
        {loading && !data ? (
          <ul className="space-y-3" aria-label="Loading your requests">
            {[0, 1, 2].map((i) => (
              <li key={i}>
                <Skeleton className="h-20 rounded-ticket" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <ErrorNote onRetry={reload}>{error.message}</ErrorNote>
        ) : !data || data.length === 0 ? (
          <EmptyState title="No requests yet">Questions and complaints you send while signed in appear here, with our replies.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {data.map((t) => (
              <li key={t.number}>
                <Link
                  href={`/account/support/${encodeURIComponent(t.number)}`}
                  className="press flex min-h-11 items-center justify-between gap-4 rounded-ticket bg-paper p-4 shadow-ticket sm:p-5"
                >
                  <span className="min-w-0">
                    <span className="font-stencil tabular block text-[12px] text-brown-soft">
                      {t.number} · {KIND_LABEL[t.kind]} · {formatDate(t.createdAt, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                    <span className="mt-1 block truncate font-semibold text-cocoa">{t.subject}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={TONE[t.status]}>{CUSTOMER_STATUS_LABEL[t.status]}</Badge>
                    <ChevronRight aria-hidden className="size-5 text-brown-soft" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
