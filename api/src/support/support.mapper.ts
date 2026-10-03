import type { SupportMessage, SupportTicket } from '../generated/prisma/client.js';
import { slaOf, type SlaView } from './support.rules.js';

/** Wire shapes: web/src/lib/types.ts `Ticket`, `AdminTicket`. */
export interface TicketMessageDto {
  id: string;
  author: 'customer' | 'maker';
  body: string;
  attachments: string[];
  at: string;
}

export interface TicketDto {
  number: string;
  kind: SupportTicket['kind'];
  channel: SupportTicket['channel'];
  status: SupportTicket['status'];
  category: string;
  subject: string;
  createdAt: string;
  /** When we told them we had it. */
  ackedAt?: string;
  /** The date we promise to have resolved it by. */
  resolveBy: string;
  resolvedAt?: string;
  resolutionNote?: string;
  /** Order or work-order number the ticket is linked to. */
  reference?: string;
  messages: TicketMessageDto[];
}

export interface AdminTicketMessageDto extends Omit<TicketMessageDto, 'author'> {
  author: 'customer' | 'maker' | 'internal';
}

export interface AdminTicketDto extends Omit<TicketDto, 'messages'> {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  userId?: string;
  orderId?: string;
  orderNumber?: string;
  workOrderId?: string;
  workOrderNumber?: string;
  ackDueAt: string;
  resolveDueAt: string;
  firstResponseAt?: string;
  closedAt?: string;
  recordCopySentAt?: string;
  scrubbed: boolean;
  lastActivityAt: string;
  sla: SlaView;
  messages: AdminTicketMessageDto[];
}

export type TicketRow = SupportTicket & {
  messages: SupportMessage[];
  order?: { id: string; number: string } | null;
  request?: { id: string; number: string } | null;
};

export const TICKET_INCLUDE = {
  messages: { orderBy: { createdAt: 'asc' } },
  order: { select: { id: true, number: true } },
  request: { select: { id: true, number: true } },
} as const;

const iso = (d: Date | null) => (d ? d.toISOString() : undefined);
const opt = <T extends Record<string, unknown>>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** What the customer sees: never the private notes, never the access-token hash. */
export function toTicketDto(t: TicketRow): TicketDto {
  return {
    number: t.number,
    kind: t.kind,
    channel: t.channel,
    status: t.status,
    category: t.category,
    subject: t.subject,
    createdAt: t.createdAt.toISOString(),
    ...opt({ ackedAt: iso(t.ackedAt), resolvedAt: iso(t.resolvedAt), resolutionNote: t.resolutionNote ?? undefined, reference: t.order?.number ?? t.request?.number }),
    resolveBy: t.resolveDueAt.toISOString(),
    messages: t.messages
      .filter((m) => m.author !== 'internal')
      .map((m) => ({ id: m.id, author: m.author as 'customer' | 'maker', body: m.body, attachments: m.attachments, at: m.createdAt.toISOString() })),
  };
}

export function toAdminTicketDto(t: TicketRow, now: Date = new Date()): AdminTicketDto {
  const { messages: _customerView, ...base } = toTicketDto(t);
  void _customerView;
  return {
    ...base,
    id: t.id,
    name: t.name,
    ...opt({
      email: t.email ?? undefined,
      phone: t.phone ?? undefined,
      userId: t.userId ?? undefined,
      orderId: t.order?.id,
      orderNumber: t.order?.number,
      workOrderId: t.request?.id,
      workOrderNumber: t.request?.number,
      firstResponseAt: iso(t.firstResponseAt),
      closedAt: iso(t.closedAt),
      recordCopySentAt: iso(t.recordCopySentAt),
    }),
    ackDueAt: t.ackDueAt.toISOString(),
    resolveDueAt: t.resolveDueAt.toISOString(),
    scrubbed: t.scrubbedAt !== null,
    lastActivityAt: t.lastActivityAt.toISOString(),
    sla: slaOf(t, now),
    messages: t.messages.map((m) => ({ id: m.id, author: m.author, body: m.body, attachments: m.attachments, at: m.createdAt.toISOString() })),
  };
}
