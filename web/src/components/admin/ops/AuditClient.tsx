"use client";

import { useState } from "react";
import { AdminPage, Panel, TableWrap, Td, Th } from "@/components/admin/ui";
import { ListSkeleton, SearchBox, useDebounced } from "@/components/admin/catalogue/kit";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote } from "@/components/ui/misc";
import { listAudit, type AuditPage, type AuditRow } from "@/lib/api/admin-ops";
import { useApi } from "@/lib/api/useApi";
import { formatDate } from "@/lib/format";

/** What was recorded about the change, short enough for a table cell. */
const metaText = (meta: unknown) => {
  if (meta == null || (typeof meta === "object" && Object.keys(meta as object).length === 0)) return "";
  const text = JSON.stringify(meta);
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
};

export function AuditClient() {
  const [action, setAction] = useState("");
  const debounced = useDebounced(action.trim());
  const first = useApi(() => listAudit({ action: debounced || undefined }), `admin-audit:${debounced}`);
  // Older pages are appended in place; a new filter starts over (first.data changes with the key).
  const [older, setOlder] = useState<{ key: string; page: AuditPage } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string>();

  const extra = older && older.key === debounced ? older.page : null;
  const rows: AuditRow[] = [...(first.data?.items ?? []), ...(extra?.items ?? [])];
  const cursor = extra ? extra.nextCursor : first.data?.nextCursor;

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    setMoreError(undefined);
    try {
      const page = await listAudit({ action: debounced || undefined, before: cursor });
      setOlder({ key: debounced, page: { items: [...(extra?.items ?? []), ...page.items], nextCursor: page.nextCursor } });
    } catch (e) {
      setMoreError(e instanceof Error ? e.message : "Couldn't load older entries.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <AdminPage title="Audit log">
      <p className="max-w-[62ch] text-brown">
        Who changed what in the admin, newest first. Addresses (IPs) are kept for 90 days, then dropped from old entries.
      </p>
      <SearchBox value={action} onChange={setAction} label="Filter by action" placeholder="Filter by action, like order or payment.refund" className="max-w-[460px]" />
      {first.error ? (
        <ErrorNote onRetry={first.reload}>{first.error.message}</ErrorNote>
      ) : first.loading && !first.data ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState title="Nothing recorded">{debounced ? "No entries match that action." : "Changes made in the admin show up here."}</EmptyState>
      ) : (
        <Panel flush>
          <TableWrap>
            <caption className="sr-only">Audit log</caption>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Action</Th>
                <Th>On</Th>
                <Th>Details</Th>
                <Th>From</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">{formatDate(r.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Td>
                  <Td>{r.actor ? r.actor.name || r.actor.email : <span className="text-brown-soft">System</span>}</Td>
                  <Td className="font-stencil text-[13px] whitespace-nowrap">{r.action}</Td>
                  <Td className="text-sm">
                    {r.entity}
                    {r.entityId ? <span className="block break-all text-brown-soft">{r.entityId}</span> : null}
                  </Td>
                  <Td className="max-w-[36ch] text-sm break-words text-brown">{metaText(r.meta)}</Td>
                  <Td className="tabular text-sm text-brown-soft">{r.ip ?? ""}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      )}
      {cursor ? (
        <div className="flex flex-col items-start gap-2">
          <Button variant="secondary" onClick={loadMore} disabled={loadingMore} aria-busy={loadingMore}>
            {loadingMore ? "Loading…" : "Show older entries"}
          </Button>
          {moreError ? <ErrorNote>{moreError}</ErrorNote> : null}
        </div>
      ) : null}
    </AdminPage>
  );
}
