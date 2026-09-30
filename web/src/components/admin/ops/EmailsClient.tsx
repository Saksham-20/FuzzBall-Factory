"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, Panel, TableWrap, Td, Th } from "@/components/admin/ui";
import { FilterChips, ListSkeleton } from "@/components/admin/catalogue/kit";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote } from "@/components/ui/misc";
import { listEmails, retryEmail, type EmailRow, type EmailStatus } from "@/lib/api/admin-ops";
import { useApi } from "@/lib/api/useApi";
import { formatDate } from "@/lib/format";

type Filter = "ALL" | EmailStatus;

const TONE: Record<EmailStatus, "ready" | "mto" | "err" | "sold"> = { SENT: "ready", PENDING: "mto", SENDING: "mto", FAILED: "err" };
const LABEL: Record<EmailStatus, string> = { SENT: "Sent", PENDING: "Waiting to retry", SENDING: "Sending", FAILED: "Gave up" };

/** "order.shipped" -> "Order shipped". */
const eventLabel = (event: string) => {
  const text = event.replace(/[._]/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function EmailsClient() {
  const [filter, setFilter] = useState<Filter>("FAILED");
  const emails = useApi(() => listEmails(filter === "ALL" ? undefined : filter), `admin-emails:${filter}`);
  const [busy, setBusy] = useState<string | null>(null);

  async function retry(row: EmailRow) {
    setBusy(row.id);
    try {
      const next = await retryEmail(row.id);
      toast.success(next.status === "SENT" ? `Sent to ${row.to}.` : `Tried again for ${row.to}; it is ${LABEL[next.status].toLowerCase()}.`);
      emails.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't resend that email.");
    } finally {
      setBusy(null);
    }
  }

  const rows = emails.data ?? [];

  return (
    <AdminPage title="Emails">
      <p className="max-w-[62ch] text-brown">
        Every email the shop sends is queued here first. A failed one retries on its own (1, 5, 15, 60 and 240 minutes); one that gave up shows below so
        you can resend it by hand. Sent emails are cleared after 30 days.
      </p>
      <FilterChips
        label="Show emails"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "FAILED", label: "Gave up" },
          { value: "PENDING", label: "Waiting to retry" },
          { value: "SENT", label: "Sent" },
          { value: "ALL", label: "All" },
        ]}
      />
      {emails.error ? (
        <ErrorNote onRetry={emails.reload}>{emails.error.message}</ErrorNote>
      ) : emails.loading && !emails.data ? (
        <ListSkeleton rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState title={filter === "FAILED" ? "Nothing has failed" : "No emails here"}>
          {filter === "FAILED" ? "Every email was delivered, or is still retrying." : "Emails appear here as the shop sends them."}
        </EmptyState>
      ) : (
        <Panel flush>
          <TableWrap>
            <caption className="sr-only">Emails</caption>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>To</Th>
                <Th>Status</Th>
                <Th className="text-right">Tries</Th>
                <Th>Queued</Th>
                <Th>Last problem</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="font-semibold whitespace-nowrap">{eventLabel(r.event)}</Td>
                  <Td className="break-all">{r.to}</Td>
                  <Td>
                    <Badge tone={TONE[r.status]}>{LABEL[r.status]}</Badge>
                  </Td>
                  <Td className="tabular text-right">{r.attempts}</Td>
                  <Td className="whitespace-nowrap">{formatDate(r.createdAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Td>
                  <Td className="max-w-[28ch] text-sm text-brown">{r.lastError ?? ""}</Td>
                  <Td>
                    {r.status === "FAILED" ? (
                      r.resendable ? (
                        <Button size="sm" variant="secondary" disabled={busy === r.id} aria-busy={busy === r.id} onClick={() => retry(r)}>
                          <RotateCw aria-hidden strokeWidth={1.8} />
                          Resend
                        </Button>
                      ) : (
                        <span className="text-sm text-brown-soft">Can&apos;t be resent</span>
                      )
                    ) : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      )}
    </AdminPage>
  );
}
