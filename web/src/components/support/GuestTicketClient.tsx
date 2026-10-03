"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { TicketThread } from "@/components/support/TicketThread";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import { getTicketByToken, replyByToken } from "@/lib/api/support";
import { ApiError } from "@/lib/api/errors";
import { useApi } from "@/lib/api/useApi";

/** A request opened from the link in our email: the token in the address is the key, no sign-in needed. */
export function GuestTicketClient({ number }: { number: string }) {
  const token = useSearchParams().get("t") ?? "";
  const { data, error, loading, reload } = useApi(() => getTicketByToken(number, token), `ticket:${number}:${token}`);

  return (
    <div className="shell py-10 md:py-14">
      {loading && !data ? (
        <div className="space-y-4" aria-label="Loading your request">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-40 rounded-ticket" />
        </div>
      ) : error ? (
        error instanceof ApiError && (error.status === 404 || error.status === 400) ? (
          <EmptyState
            title="We can't open that request"
            action={
              <Button asChild>
                <Link href="/contact">Contact us</Link>
              </Button>
            }
          >
            The link may be incomplete. Use the full link from our email, or sign in if you have an account.
          </EmptyState>
        ) : (
          <ErrorNote onRetry={reload}>{error.message}</ErrorNote>
        )
      ) : data ? (
        <TicketThread ticket={data} onReply={(body) => replyByToken(number, token, { body })} />
      ) : null}
    </div>
  );
}
