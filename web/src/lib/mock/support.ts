import { createPersistedStore } from "@/lib/store";
import { ApiError } from "@/lib/api/errors";
import { db } from "@/lib/mock/db";
import { CATEGORIES, NUMBER_PREFIX, dueDates, isOpen, slaOf } from "@/lib/support";
import type { AdminTicket, AdminTicketMessage, Ticket, TicketChannel, TicketKind } from "@/lib/types";

/**
 * Mock support inbox (sample mode only): a small localStorage store, separate from the main mock database so older saved
 * data keeps working. It follows the same rules as the API (numbers, clocks, who sees what), so the screens behave alike.
 */
interface MockTicket extends Omit<AdminTicket, "sla"> {
  token: string;
}
interface State {
  tickets: MockTicket[];
  seq: Record<TicketKind, number>;
}

const initial: State = { tickets: [], seq: { SUPPORT: 0, GRIEVANCE: 0, IP_NOTICE: 0, DATA_REQUEST: 0 } };
export const supportStore = createPersistedStore<State>("fbf-mock-support-v1", initial);

const iso = (d: Date) => d.toISOString();
const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const state = () => supportStore.getSnapshot();
const update = (fn: (s: State) => State) => supportStore.set((cur) => fn(structuredClone(cur)));

const sla = (t: MockTicket) =>
  slaOf({ status: t.status, kind: t.kind, ackDueAt: new Date(t.ackDueAt), ackedAt: t.ackedAt ? new Date(t.ackedAt) : null, resolveDueAt: new Date(t.resolveDueAt), resolvedAt: t.resolvedAt ? new Date(t.resolvedAt) : null });

export function toAdmin(t: MockTicket): AdminTicket {
  const { token: _token, ...rest } = t;
  void _token;
  return { ...rest, sla: sla(t) };
}

export function toCustomer(t: MockTicket): Ticket {
  return {
    number: t.number,
    kind: t.kind,
    channel: t.channel,
    status: t.status,
    category: t.category,
    subject: t.subject,
    createdAt: t.createdAt,
    ackedAt: t.ackedAt,
    resolveBy: t.resolveDueAt,
    resolvedAt: t.resolvedAt,
    resolutionNote: t.resolutionNote,
    reference: t.orderNumber ?? t.workOrderNumber,
    messages: t.messages.filter((m) => m.author !== "internal").map((m) => ({ ...m, author: m.author as "customer" | "maker" })),
  };
}

export function mockCreate(input: {
  kind: TicketKind;
  channel?: TicketChannel;
  name: string;
  email?: string;
  phone?: string;
  category: string;
  reference?: string;
  message: string;
  consent?: boolean;
  receivedAt?: string;
  alreadyAcknowledged?: boolean;
  userId?: string;
}): { ticket: MockTicket } {
  if (!CATEGORIES[input.kind].some((c) => c.value === input.category)) throw new ApiError(400, "Choose one of the topics in the list.", { category: "Choose one of the topics in the list." });
  if (input.consent === false) throw new ApiError(400, "Please confirm you have read the privacy notice.", { consent: "Please confirm you have read the privacy notice." });
  const when = input.receivedAt ? new Date(input.receivedAt) : new Date();
  let created!: MockTicket;
  update((s) => {
    s.seq[input.kind] += 1;
    const number = `${NUMBER_PREFIX[input.kind]}-${String(s.seq[input.kind]).padStart(4, "0")}`;
    const due = dueDates(input.kind, when);
    const topic = input.category.replace(/-/g, " ");
    created = {
      id: uid(),
      token: uid() + uid(),
      number,
      kind: input.kind,
      channel: input.channel ?? "WEB",
      status: "OPEN",
      category: input.category,
      subject: `${{ SUPPORT: "Message", GRIEVANCE: "Complaint", IP_NOTICE: "Copyright or trademark notice", DATA_REQUEST: "Data request" }[input.kind]}: ${topic}`,
      name: input.name,
      email: input.email,
      phone: input.phone,
      userId: input.userId,
      createdAt: iso(when),
      ackedAt: input.alreadyAcknowledged || input.email ? iso(new Date()) : undefined,
      recordCopySentAt: input.email && !input.alreadyAcknowledged ? iso(new Date()) : undefined,
      ackDueAt: iso(due.ackDueAt),
      resolveDueAt: iso(due.resolveDueAt),
      resolveBy: iso(due.resolveDueAt),
      scrubbed: false,
      lastActivityAt: iso(when),
      messages: [{ id: uid(), author: "customer", body: input.message, attachments: [], at: iso(when) }],
    };
    s.tickets.unshift(created);
    return s;
  });
  return { ticket: created };
}

function find(number: string, token: string): MockTicket {
  const t = state().tickets.find((x) => x.number === number && x.token === token);
  if (!t) throw new ApiError(404, "We could not find that request.");
  return t;
}

export function mockMessage(id: string, author: AdminTicketMessage["author"], body: string, opts: { internal?: boolean } = {}): MockTicket {
  let out!: MockTicket;
  update((s) => {
    const t = s.tickets.find((x) => x.id === id);
    if (!t) throw new ApiError(404, "We could not find that request.");
    if (author === "customer" && t.status === "CLOSED") throw new ApiError(409, "This request is closed. Please start a new one.");
    const now = iso(new Date());
    t.messages.push({ id: uid(), author, body, attachments: [], at: now });
    t.lastActivityAt = now;
    if (author === "customer") {
      t.status = "OPEN";
      t.resolvedAt = undefined;
    } else if (author === "maker" && !opts.internal) {
      if (t.status === "OPEN") t.status = "WAITING_CUSTOMER";
      t.firstResponseAt ??= now;
      t.ackedAt ??= now;
    }
    out = t;
    return s;
  });
  return out;
}

export const mockByToken = find;
export const mockAll = () => state().tickets;
export const mockById = (id: string) => {
  const t = state().tickets.find((x) => x.id === id);
  if (!t) throw new ApiError(404, "We could not find that request.");
  return t;
};
export const mockMine = () => {
  const userId = db.get().session?.userId;
  return userId ? state().tickets.filter((t) => t.userId === userId) : [];
};
export const mockUserId = () => db.get().session?.userId;

export function mockPatch(id: string, fn: (t: MockTicket) => void): MockTicket {
  let out!: MockTicket;
  update((s) => {
    const t = s.tickets.find((x) => x.id === id);
    if (!t) throw new ApiError(404, "We could not find that request.");
    fn(t);
    t.lastActivityAt = iso(new Date());
    out = t;
    return s;
  });
  return out;
}

export { isOpen };
