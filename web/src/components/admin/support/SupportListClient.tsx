"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Plus } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, Panel, TableWrap, Td, Th } from "@/components/admin/ui";
import { FilterChips, ListSkeleton, SearchBox, Toolbar, useDebounced } from "@/components/admin/catalogue/kit";
import { LogTicketModal } from "@/components/admin/support/LogTicketModal";
import { SlaCell, STATUS_TONE } from "@/components/admin/support/sla";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { EmptyState, ErrorNote } from "@/components/ui/misc";
import { downloadRegister, listAdminTickets, supportCounts, type AdminTicketQuery } from "@/lib/api/admin-support";
import { useApi } from "@/lib/api/useApi";
import { formatDate } from "@/lib/format";
import { CHANNEL_LABEL, KIND_LABEL, STATUS_LABEL, TICKET_KINDS, categoryLabel } from "@/lib/support";
import type { TicketKind } from "@/lib/types";

type Tab = "active" | "overdue" | "unacknowledged" | "resolved" | "all";

const QUERY: Record<Tab, AdminTicketQuery> = {
  active: { status: "ACTIVE" },
  overdue: { filter: "overdue" },
  unacknowledged: { filter: "unacknowledged" },
  resolved: { status: "RESOLVED" },
  all: {},
};

export function SupportListClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("active");
  const [kind, setKind] = useState<TicketKind | "">("");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim());
  const [logging, setLogging] = useState(false);
  const query: AdminTicketQuery = { ...QUERY[tab], ...(kind ? { kind } : {}), ...(q ? { q } : {}) };
  const list = useApi(() => listAdminTickets(query), `admin-support:${tab}:${kind}:${q}`);
  const counts = useApi(supportCounts, "admin-support-counts");
  const rows = list.data ?? [];

  async function register() {
    try {
      await downloadRegister();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "The register could not be downloaded.");
    }
  }

  return (
    <AdminPage
      title="Support"
      actions={
        <>
          <Button variant="secondary" onClick={register}>
            <Download aria-hidden strokeWidth={1.8} />
            Grievance register
          </Button>
          <Button onClick={() => setLogging(true)}>
            <Plus aria-hidden strokeWidth={1.8} />
            Log a request
          </Button>
        </>
      }
    >
      <p className="max-w-[64ch] text-brown">
        Every message, complaint, takedown notice and data request lands here with a reference number. Acknowledge each within 48 hours; resolve a
        complaint within one month (the law asks for both). Log WhatsApp and phone complaints too, so the register is complete.
      </p>
      <Toolbar>
        <FilterChips
          label="Show requests"
          value={tab}
          onChange={setTab}
          options={[
            { value: "active", label: "Open", count: counts.data?.open },
            { value: "unacknowledged", label: "Not acknowledged", count: counts.data?.unacknowledged },
            { value: "overdue", label: "Overdue", count: counts.data?.overdue },
            { value: "resolved", label: "Resolved" },
            { value: "all", label: "All" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-3">
          <SearchBox value={search} onChange={setSearch} label="Search requests" placeholder="Reference, name, email" />
          <label className="flex items-center gap-2 text-sm font-semibold">
            <span className="sr-only sm:not-sr-only">Kind</span>
            <Select value={kind} onChange={(e) => setKind(e.target.value as TicketKind | "")} className="h-11 w-auto min-w-[10rem]">
              <option value="">All kinds</option>
              {TICKET_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </Toolbar>

      {list.error ? (
        <ErrorNote onRetry={list.reload}>{list.error.message}</ErrorNote>
      ) : list.loading && !list.data ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState title={tab === "active" ? "Nothing waiting" : "No requests here"}>
          {tab === "active" ? "Every request has been answered. New ones appear here and in your inbox." : "Try another filter, or log a request that came in elsewhere."}
        </EmptyState>
      ) : (
        <Panel flush>
          <TableWrap>
            <caption className="sr-only">Support requests</caption>
            <thead>
              <tr>
                <Th>Request</Th>
                <Th>From</Th>
                <Th>Received</Th>
                <Th>Acknowledge</Th>
                <Th>Resolve</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/5"
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest("a")) router.push(`/admin/support/${t.id}`);
                  }}
                >
                  <Td className="max-w-[30ch]">
                    <Link href={`/admin/support/${t.id}`} className="font-stencil tabular block text-[12px] font-bold text-cocoa underline">
                      {t.number}
                    </Link>
                    <span className="block truncate text-sm text-brown">
                      {KIND_LABEL[t.kind]} · {categoryLabel(t.kind, t.category)}
                    </span>
                  </Td>
                  <Td className="max-w-[24ch]">
                    <span className="block truncate font-semibold">{t.name}</span>
                    <span className="block truncate text-sm text-brown-soft">{CHANNEL_LABEL[t.channel]}</span>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(t.createdAt, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</Td>
                  <Td>
                    <SlaCell state={t.sla.ack} ms={t.sla.ackMs} doneLabel="Acknowledged" />
                  </Td>
                  <Td>
                    <SlaCell state={t.sla.resolve} ms={t.sla.resolveMs} doneLabel={t.status === "CLOSED" ? "Closed" : "Resolved"} />
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Panel>
      )}

      <LogTicketModal
        open={logging}
        onOpenChange={setLogging}
        onLogged={(t) => {
          list.reload();
          counts.reload();
          router.push(`/admin/support/${t.id}`);
        }}
      />
    </AdminPage>
  );
}
