"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TicketThread } from "@/components/support/TicketThread";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import { getMyTicket, replyMine } from "@/lib/api/support";
import { ApiError } from "@/lib/api/errors";
import { useApi } from "@/lib/api/useApi";

export function TicketDetailClient({ number }: { number: string }) {
  const { data, error, loading, reload } = useApi(() => getMyTicket(number), `my-ticket:${number}`);
  return (
    <div>
      <Link href="/account/support" className="mb-5 inline-flex min-h-11 items-center gap-1.5 font-semibold text-cocoa underline">
        <ArrowLeft aria-hidden className="size-4" /> All requests
      </Link>
      {loading && !data ? (
        <div className="space-y-4" aria-label="Loading your request">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 rounded-ticket" />
        </div>
      ) : error ? (
        error instanceof ApiError && error.status === 404 ? (
          <EmptyState title="We can't find that request">It may belong to another account.</EmptyState>
        ) : (
          <ErrorNote onRetry={reload}>{error.message}</ErrorNote>
        )
      ) : data ? (
        <TicketThread ticket={data} onReply={(body) => replyMine(number, { body })} />
      ) : null}
    </div>
  );
}
