import type { TicketKind, TicketStatus } from '../generated/prisma/enums.js';

/**
 * The rules of the support inbox in one place (pure functions, unit-tested).
 *
 * Every contact message, grievance, takedown notice and data request is a ticket. The E-Commerce Rules 2020 ask for an
 * acknowledgement within 48 hours and redress within one month of a grievance (docs/LEGAL_REVIEW.md); the other kinds
 * get shorter targets of our own.
 */
export const TICKET_KINDS = ['SUPPORT', 'GRIEVANCE', 'IP_NOTICE', 'DATA_REQUEST'] as const;
export const TICKET_CHANNELS = ['WEB', 'EMAIL', 'WHATSAPP', 'PHONE', 'POST'] as const;
export const TICKET_STATUSES = ['OPEN', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'] as const;

export const NUMBER_PREFIX: Record<TicketKind, string> = { SUPPORT: 'SUP', GRIEVANCE: 'GRV', IP_NOTICE: 'IPN', DATA_REQUEST: 'DSR' };
export const formatTicketNumber = (kind: TicketKind, n: number) => `${NUMBER_PREFIX[kind]}-${String(n).padStart(4, '0')}`;

/** The topics a person can pick, per kind. The first is the default. */
export const CATEGORIES: Record<TicketKind, readonly string[]> = {
  SUPPORT: ['general', 'order', 'custom', 'shipping', 'payment', 'product', 'website'],
  GRIEVANCE: ['order', 'delivery', 'refund', 'quality', 'payment', 'privacy', 'website', 'other'],
  IP_NOTICE: ['copyright', 'trademark', 'other'],
  DATA_REQUEST: ['access', 'correction', 'erasure', 'withdraw-consent', 'other'],
};

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Hours to acknowledge any ticket (E-Commerce Rules 2020, r.4(5)). */
export const ACK_HOURS = 48;
/** Days to resolve, by kind. A grievance is one month; a data request follows the privacy policy's one month. */
export const RESOLVE_DAYS: Record<TicketKind, number> = { SUPPORT: 7, GRIEVANCE: 30, IP_NOTICE: 7, DATA_REQUEST: 30 };
/** A resolved ticket the customer does not answer closes by itself after this many days. */
export const AUTOCLOSE_DAYS = 14;
/** Closed tickets are deleted after this long (complaint limitation period plus margin). */
export const RETAIN_AFTER_CLOSE_DAYS = 3 * 365;
/** The owner gets one nudge when the ack is this close, and one when the resolve date is this close. */
export const ACK_REMINDER_HOURS = 12;
export const RESOLVE_REMINDER_DAYS = 5;

export function dueDates(kind: TicketKind, createdAt: Date): { ackDueAt: Date; resolveDueAt: Date } {
  return { ackDueAt: new Date(createdAt.getTime() + ACK_HOURS * HOUR_MS), resolveDueAt: new Date(createdAt.getTime() + RESOLVE_DAYS[kind] * DAY_MS) };
}

export const isOpen = (status: TicketStatus) => status === 'OPEN' || status === 'WAITING_CUSTOMER';

export type SlaState = 'done' | 'ok' | 'due-soon' | 'overdue';

export interface SlaView {
  /** Acknowledgement: done once sent. */
  ack: SlaState;
  ackMs: number;
  resolve: SlaState;
  resolveMs: number;
}

interface SlaInput {
  status: TicketStatus;
  kind: TicketKind;
  ackDueAt: Date;
  ackedAt: Date | null;
  resolveDueAt: Date;
  resolvedAt: Date | null;
}

/** Where a ticket stands against its two clocks. `*Ms` is the time left (negative = overdue); `done` ignores it. */
export function slaOf(t: SlaInput, now: Date = new Date()): SlaView {
  const ackMs = t.ackDueAt.getTime() - now.getTime();
  const resolveMs = t.resolveDueAt.getTime() - now.getTime();
  const ack: SlaState = t.ackedAt ? 'done' : ackMs < 0 ? 'overdue' : ackMs <= ACK_REMINDER_HOURS * HOUR_MS ? 'due-soon' : 'ok';
  const closed = !isOpen(t.status);
  const resolve: SlaState = closed || t.resolvedAt ? 'done' : resolveMs < 0 ? 'overdue' : resolveMs <= Math.min(RESOLVE_REMINDER_DAYS, RESOLVE_DAYS[t.kind] / 3) * DAY_MS ? 'due-soon' : 'ok';
  return { ack, ackMs, resolve, resolveMs };
}

/** Status after the customer writes: an answered or resolved ticket is open again. A closed one stays closed. */
export function statusAfterCustomerMessage(status: TicketStatus): TicketStatus | null {
  if (status === 'CLOSED') return null;
  return 'OPEN';
}

/** Status after the maker writes a reply: now the customer's turn (unless it is already resolved or closed). */
export function statusAfterMakerReply(status: TicketStatus): TicketStatus {
  return status === 'OPEN' ? 'WAITING_CUSTOMER' : status;
}
