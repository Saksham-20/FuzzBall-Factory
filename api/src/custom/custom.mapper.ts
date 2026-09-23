import type { Prisma } from '../generated/prisma/client.js';
import type { BreakdownLine } from './custom.rules.js';

/** Everything the web `CustomRequest` needs, in one query. */
export const customInclude = {
  images: { orderBy: { sortOrder: 'asc' } },
  messages: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  quotes: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
  events: { orderBy: [{ at: 'asc' }, { id: 'asc' }] },
  baseProduct: { select: { slug: true } },
} satisfies Prisma.CustomRequestInclude;

export type CustomRow = Prisma.CustomRequestGetPayload<{ include: typeof customInclude }>;

/* Wire types: identical to web/src/lib/types.ts (optional fields are omitted, never null). */

export interface QuoteDto {
  id: string;
  price: number;
  depositPct: number;
  breakdown: BreakdownLine[];
  timelineDays: number;
  revisions: number;
  scope: string;
  validUntil: string;
  status: 'SENT' | 'COUNTERED' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  counter?: { amount: number; note: string; at: string };
  createdAt: string;
}

export interface CustomMessageDto {
  id: string;
  author: 'customer' | 'maker';
  body: string;
  attachments?: string[];
  at: string;
}

export interface TimelineEventDto {
  status: string;
  at: string;
  note?: string;
  photo?: string;
}

export interface CustomRequestDto {
  number: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  kind: 'NEW' | 'CUSTOMIZE';
  baseProductSlug?: string;
  category: string;
  title: string;
  description: string;
  colours: string[];
  size: string;
  quantity: number;
  budgetMin: number;
  budgetMax: number;
  neededBy?: string;
  occasion?: string;
  personalization?: string;
  references: string[];
  country: string;
  postalCode: string;
  status: string;
  quotes: QuoteDto[];
  messages: CustomMessageDto[];
  events: TimelineEventDto[];
  createdAt: string;
  /** Extra (not in the web type yet): set once the piece has shipped. */
  courier?: string;
  awb?: string;
}

const breakdownOf = (json: Prisma.JsonValue): BreakdownLine[] =>
  Array.isArray(json)
    ? json.flatMap((l) => {
        const line = l as { label?: unknown; amount?: unknown } | null;
        return line && typeof line.label === 'string' && typeof line.amount === 'number' ? [{ label: line.label, amount: line.amount }] : [];
      })
    : [];

export const toQuoteDto = (q: CustomRow['quotes'][number]): QuoteDto => ({
  id: q.id,
  price: q.price,
  depositPct: q.depositPct,
  breakdown: breakdownOf(q.breakdown),
  timelineDays: q.timelineDays,
  revisions: q.revisions,
  scope: q.scope,
  validUntil: q.validUntil.toISOString(),
  status: q.status,
  ...(q.counterAmount != null && q.counterAt ? { counter: { amount: q.counterAmount, note: q.counterNote ?? '', at: q.counterAt.toISOString() } } : {}),
  createdAt: q.createdAt.toISOString(),
});

export function toCustomRequestDto(r: CustomRow): CustomRequestDto {
  return {
    number: r.number,
    userId: r.userId,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    kind: r.kind,
    ...(r.baseProduct ? { baseProductSlug: r.baseProduct.slug } : {}),
    category: r.category,
    title: r.title,
    description: r.description,
    colours: r.colours,
    size: r.size,
    quantity: r.quantity,
    budgetMin: r.budgetMin,
    budgetMax: r.budgetMax,
    ...(r.neededBy ? { neededBy: r.neededBy.toISOString() } : {}),
    ...(r.occasion ? { occasion: r.occasion } : {}),
    ...(r.personalization ? { personalization: r.personalization } : {}),
    references: r.images.map((i) => i.url),
    country: r.country,
    postalCode: r.postalCode,
    status: r.status,
    quotes: r.quotes.map(toQuoteDto),
    messages: r.messages.map((m) => ({
      id: m.id,
      author: m.author,
      body: m.body,
      ...(m.attachments.length > 0 ? { attachments: m.attachments } : {}),
      at: m.createdAt.toISOString(),
    })),
    events: r.events.map((e) => ({ status: e.status, at: e.at.toISOString(), ...(e.note ? { note: e.note } : {}), ...(e.photo ? { photo: e.photo } : {}) })),
    createdAt: r.createdAt.toISOString(),
    ...(r.courier ? { courier: r.courier } : {}),
    ...(r.awb ? { awb: r.awb } : {}),
  };
}
