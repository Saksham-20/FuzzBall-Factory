import type { SlaState, TicketChannel, TicketKind, TicketStatus } from "@/lib/types";

/**
 * Support ticket vocabulary and clocks. The rules mirror api/src/support/support.rules.ts: if one changes, change the other
 * (the ack and resolve windows are promises made on the grievance page).
 */
export const TICKET_KINDS: TicketKind[] = ["SUPPORT", "GRIEVANCE", "IP_NOTICE", "DATA_REQUEST"];
export const TICKET_CHANNELS: TicketChannel[] = ["WEB", "EMAIL", "WHATSAPP", "PHONE", "POST"];

export const KIND_LABEL: Record<TicketKind, string> = { SUPPORT: "Message", GRIEVANCE: "Complaint", IP_NOTICE: "Takedown notice", DATA_REQUEST: "Data request" };
export const CHANNEL_LABEL: Record<TicketChannel, string> = { WEB: "Website", EMAIL: "Email", WHATSAPP: "WhatsApp", PHONE: "Phone", POST: "Post" };
export const STATUS_LABEL: Record<TicketStatus, string> = { OPEN: "Open", WAITING_CUSTOMER: "Waiting for the customer", RESOLVED: "Resolved", CLOSED: "Closed" };
/** What the customer reads: the same states in their own words. */
export const CUSTOMER_STATUS_LABEL: Record<TicketStatus, string> = { OPEN: "We are on it", WAITING_CUSTOMER: "Waiting for your reply", RESOLVED: "Resolved", CLOSED: "Closed" };

export const CATEGORIES: Record<TicketKind, { value: string; label: string }[]> = {
  SUPPORT: [
    { value: "general", label: "A general question" },
    { value: "order", label: "My order" },
    { value: "custom", label: "A work order" },
    { value: "shipping", label: "Shipping or delivery" },
    { value: "payment", label: "Payment or refund" },
    { value: "product", label: "A product" },
    { value: "website", label: "This website" },
  ],
  GRIEVANCE: [
    { value: "order", label: "My order" },
    { value: "delivery", label: "Delivery" },
    { value: "refund", label: "A refund" },
    { value: "quality", label: "Quality of a piece" },
    { value: "payment", label: "Payment" },
    { value: "privacy", label: "My personal data" },
    { value: "website", label: "This website" },
    { value: "other", label: "Something else" },
  ],
  IP_NOTICE: [
    { value: "copyright", label: "Copyright" },
    { value: "trademark", label: "Trademark" },
    { value: "other", label: "Something else" },
  ],
  DATA_REQUEST: [
    { value: "access", label: "See the data you hold about me" },
    { value: "correction", label: "Correct my data" },
    { value: "erasure", label: "Erase my data" },
    { value: "withdraw-consent", label: "Withdraw my consent" },
    { value: "other", label: "Something else" },
  ],
};

export const categoryLabel = (kind: TicketKind, category: string) => CATEGORIES[kind].find((c) => c.value === category)?.label ?? category.replace(/-/g, " ");

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
export const ACK_HOURS = 48;
export const RESOLVE_DAYS: Record<TicketKind, number> = { SUPPORT: 7, GRIEVANCE: 30, IP_NOTICE: 7, DATA_REQUEST: 30 };
export const ACK_REMINDER_HOURS = 12;
export const RESOLVE_REMINDER_DAYS = 5;

export const NUMBER_PREFIX: Record<TicketKind, string> = { SUPPORT: "SUP", GRIEVANCE: "GRV", IP_NOTICE: "IPN", DATA_REQUEST: "DSR" };

export function dueDates(kind: TicketKind, createdAt: Date) {
  return { ackDueAt: new Date(createdAt.getTime() + ACK_HOURS * HOUR_MS), resolveDueAt: new Date(createdAt.getTime() + RESOLVE_DAYS[kind] * DAY_MS) };
}

export const isOpen = (status: TicketStatus) => status === "OPEN" || status === "WAITING_CUSTOMER";

export function slaOf(
  t: { status: TicketStatus; kind: TicketKind; ackDueAt: Date; ackedAt: Date | null; resolveDueAt: Date; resolvedAt: Date | null },
  now: Date = new Date(),
): { ack: SlaState; ackMs: number; resolve: SlaState; resolveMs: number } {
  const ackMs = t.ackDueAt.getTime() - now.getTime();
  const resolveMs = t.resolveDueAt.getTime() - now.getTime();
  const ack: SlaState = t.ackedAt ? "done" : ackMs < 0 ? "overdue" : ackMs <= ACK_REMINDER_HOURS * HOUR_MS ? "due-soon" : "ok";
  const closed = !isOpen(t.status);
  const resolve: SlaState =
    closed || t.resolvedAt ? "done" : resolveMs < 0 ? "overdue" : resolveMs <= Math.min(RESOLVE_REMINDER_DAYS, RESOLVE_DAYS[t.kind] / 3) * DAY_MS ? "due-soon" : "ok";
  return { ack, ackMs, resolve, resolveMs };
}

/** "5 hours left", "overdue by 2 days": the words that go next to a deadline. Never colour alone. */
export function timeLeftLabel(ms: number): string {
  const abs = Math.abs(ms);
  const hours = Math.floor(abs / HOUR_MS);
  const text = hours < 48 ? `${Math.max(1, hours)} ${hours <= 1 ? "hour" : "hours"}` : `${Math.floor(abs / DAY_MS)} days`;
  return ms < 0 ? `overdue by ${text}` : `${text} left`;
}
