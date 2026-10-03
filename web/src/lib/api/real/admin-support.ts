import { http } from "@/lib/api/http";
import type { AdminTicket, SupportCounts, TicketChannel, TicketKind, TicketStatus } from "@/lib/types";

export interface AdminTicketQuery {
  status?: TicketStatus | "ACTIVE";
  kind?: TicketKind;
  filter?: "overdue" | "due-soon" | "unacknowledged";
  q?: string;
}

export interface LogTicketInput {
  kind: TicketKind;
  channel: TicketChannel;
  name: string;
  email?: string;
  phone?: string;
  category: string;
  reference?: string;
  message: string;
  /** ISO time the customer really wrote. Their clocks start then. */
  receivedAt?: string;
  alreadyAcknowledged: boolean;
}

export const listAdminTickets = (q: AdminTicketQuery) => http<AdminTicket[]>("/admin/support", { query: { ...q } });
export const getAdminTicket = (id: string) => http<AdminTicket>(`/admin/support/${encodeURIComponent(id)}`);
export const supportCounts = () => http<SupportCounts>("/admin/support/counts");
export const logTicket = (input: LogTicketInput) => http<AdminTicket>("/admin/support", { method: "POST", body: input });
export const replyAdminTicket = (id: string, body: { body: string; internal: boolean }) =>
  http<AdminTicket>(`/admin/support/${encodeURIComponent(id)}/messages`, { method: "POST", body });
export const acknowledgeTicket = (id: string) => http<AdminTicket>(`/admin/support/${encodeURIComponent(id)}/acknowledge`, { method: "POST" });
export const patchAdminTicket = (id: string, body: { category?: string; status?: "OPEN" | "WAITING_CUSTOMER" | "CLOSED"; reference?: string }) =>
  http<AdminTicket>(`/admin/support/${encodeURIComponent(id)}`, { method: "PATCH", body });
export const resolveTicket = (id: string, body: { note: string; notify: boolean }) =>
  http<AdminTicket>(`/admin/support/${encodeURIComponent(id)}/resolve`, { method: "POST", body });
export const reopenTicket = (id: string) => http<AdminTicket>(`/admin/support/${encodeURIComponent(id)}/reopen`, { method: "POST" });
/** The grievance register as a CSV download link (the browser sends the cookies). */
export const registerCsvUrl = (from?: string, to?: string) => {
  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  return `${(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "")}/admin/support/register.csv${qs.toString() ? `?${qs}` : ""}`;
};
