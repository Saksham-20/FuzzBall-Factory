import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/admin-support";
import { wait } from "@/lib/mock/db";
import { mockAll, mockById, mockCreate, mockMessage, mockPatch, toAdmin } from "@/lib/mock/support";
import { ApiError } from "@/lib/api/errors";
import { CATEGORIES, isOpen } from "@/lib/support";
import type { AdminTicket, SupportCounts } from "@/lib/types";
import type { AdminTicketQuery, LogTicketInput } from "@/lib/api/real/admin-support";

export type { AdminTicketQuery, LogTicketInput } from "@/lib/api/real/admin-support";
export { registerCsvUrl } from "@/lib/api/real/admin-support";

export async function listAdminTickets(q: AdminTicketQuery = {}): Promise<AdminTicket[]> {
  if (!SITE.useMock) return real.listAdminTickets(q);
  await wait(120);
  const needle = q.q?.toLowerCase();
  const rows = mockAll()
    .map(toAdmin)
    .filter((t) => (q.status === "ACTIVE" ? isOpen(t.status) : q.status ? t.status === q.status : true))
    .filter((t) => (q.kind ? t.kind === q.kind : true))
    .filter((t) => (needle ? [t.number, t.name, t.email ?? "", t.subject].some((v) => v.toLowerCase().includes(needle)) : true))
    .filter((t) => {
      if (!q.filter) return true;
      if (!isOpen(t.status)) return false;
      if (q.filter === "unacknowledged") return t.sla.ack !== "done";
      if (q.filter === "overdue") return t.sla.ack === "overdue" || t.sla.resolve === "overdue";
      return t.sla.ack === "due-soon" || t.sla.resolve === "due-soon";
    });
  return rows.sort((a, b) => Number(isOpen(b.status)) - Number(isOpen(a.status)) || b.lastActivityAt.localeCompare(a.lastActivityAt));
}

export async function getAdminTicket(id: string): Promise<AdminTicket> {
  if (!SITE.useMock) return real.getAdminTicket(id);
  await wait(100);
  return toAdmin(mockById(id));
}

export async function supportCounts(): Promise<SupportCounts> {
  if (!SITE.useMock) return real.supportCounts();
  await wait(60);
  const open = mockAll().filter((t) => isOpen(t.status)).map(toAdmin);
  return {
    open: open.length,
    unacknowledged: open.filter((t) => t.sla.ack !== "done").length,
    overdue: open.filter((t) => t.sla.ack === "overdue" || t.sla.resolve === "overdue").length,
    dueSoon: open.filter((t) => !(t.sla.ack === "overdue" || t.sla.resolve === "overdue") && (t.sla.ack === "due-soon" || t.sla.resolve === "due-soon")).length,
  };
}

export async function logTicket(input: LogTicketInput): Promise<AdminTicket> {
  if (!SITE.useMock) return real.logTicket(input);
  await wait(300);
  if (input.receivedAt && new Date(input.receivedAt).getTime() > Date.now()) throw new ApiError(400, "That date is in the future.", { receivedAt: "That date is in the future." });
  return toAdmin(mockCreate(input).ticket);
}

export async function replyAdminTicket(id: string, body: { body: string; internal: boolean }): Promise<AdminTicket> {
  if (!SITE.useMock) return real.replyAdminTicket(id, body);
  await wait(250);
  return toAdmin(mockMessage(id, body.internal ? "internal" : "maker", body.body, { internal: body.internal }));
}

export async function acknowledgeTicket(id: string): Promise<AdminTicket> {
  if (!SITE.useMock) return real.acknowledgeTicket(id);
  await wait(150);
  return toAdmin(mockPatch(id, (t) => void (t.ackedAt ??= new Date().toISOString())));
}

export async function patchAdminTicket(id: string, body: { category?: string; status?: "OPEN" | "WAITING_CUSTOMER" | "CLOSED"; reference?: string }): Promise<AdminTicket> {
  if (!SITE.useMock) return real.patchAdminTicket(id, body);
  await wait(200);
  return toAdmin(
    mockPatch(id, (t) => {
      if (body.category) {
        if (!CATEGORIES[t.kind].some((c) => c.value === body.category)) throw new ApiError(400, "Choose one of the topics in the list.", { category: "Choose one of the topics in the list." });
        t.category = body.category;
      }
      if (body.status) {
        t.status = body.status;
        t.closedAt = body.status === "CLOSED" ? new Date().toISOString() : undefined;
      }
    }),
  );
}

export async function resolveTicket(id: string, body: { note: string; notify: boolean }): Promise<AdminTicket> {
  if (!SITE.useMock) return real.resolveTicket(id, body);
  await wait(250);
  if (!isOpen(mockById(id).status)) throw new ApiError(409, "This request is already resolved or closed.");
  mockMessage(id, "maker", `Resolved: ${body.note}`);
  return toAdmin(
    mockPatch(id, (t) => {
      const now = new Date().toISOString();
      t.status = "RESOLVED";
      t.resolvedAt = now;
      t.resolutionNote = body.note;
    }),
  );
}

export async function reopenTicket(id: string): Promise<AdminTicket> {
  if (!SITE.useMock) return real.reopenTicket(id);
  await wait(150);
  if (isOpen(mockById(id).status)) throw new ApiError(409, "This request is already open.");
  return toAdmin(mockPatch(id, (t) => { t.status = "OPEN"; t.resolvedAt = undefined; t.closedAt = undefined; }));
}

/** The register as a CSV file, fetched with the admin's cookies and handed to the browser as a download. */
export async function downloadRegister(): Promise<void> {
  const rows = SITE.useMock
    ? ["number,kind,channel,category,received,acknowledged,resolved,status", ...mockAll().map((t) => [t.number, t.kind, t.channel, t.category, t.createdAt, t.ackedAt ?? "", t.resolvedAt ?? "", t.status].join(","))].join("\n") + "\n"
    : await (async () => {
        const res = await fetch(real.registerCsvUrl(), { credentials: "include" });
        if (!res.ok) throw new ApiError(res.status, "The register could not be downloaded.");
        return res.text();
      })();
  const url = URL.createObjectURL(new Blob([rows], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "grievance-register.csv";
  a.click();
  URL.revokeObjectURL(url);
}
