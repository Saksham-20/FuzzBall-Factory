import { Injectable } from '@nestjs/common';
import { PRODUCT_INCLUDE, toProductDto, type ProductDto } from '../catalog/product.mapper.js';
import { QuoteExpiryService } from '../custom/quote-expiry.service.js';
import type { OrderStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** The shop lives in India: "today" starts at midnight IST, whatever the server's time zone is. */
export const STORE_TZ = 'Asia/Kolkata';
const DAY_MS = 86_400_000;
const REVENUE_DAYS = 30;
const LOW_STOCK_AT = 2;
const EXPIRING_WITHIN_MS = 2 * DAY_MS;
/** Order stages that count as "in the workshop": being made or packed, not yet handed to a courier. */
const PRODUCTION_ORDER_STATUSES: OrderStatus[] = ['IN_PRODUCTION', 'PACKED'];

export interface NeedsYou {
  kind: 'cod' | 'quote' | 'counter' | 'expiring' | 'pack' | 'approval-wait';
  label: string;
  href: string;
  at: string;
}

/** Aggregate load across both fulfilment streams, so a maker running ready-stock and made-to-order at once can see the queue at a glance. */
export interface WorkshopLoad {
  ordersInProduction: number;
  customInProgress: number;
  /** Days since the single oldest item now in production/progress started that stage; `null` when nothing is in progress. */
  oldestDays: number | null;
  summary: string;
}

/** Wire shape: web admin `Dashboard`. */
export interface DashboardDto {
  ordersToday: number;
  revenue: { today: number; d7: number; d30: number };
  pendingCod: number;
  toQuote: number;
  awaitingCustomer: number;
  inProgress: number;
  lowStock: ProductDto[];
  needsYou: NeedsYou[];
  workshopLoad: WorkshopLoad;
  /** Paid order revenue per IST day, last 30 days, oldest first. `date` is that day's midnight (IST) as ISO. */
  revenueByDay: { date: string; amount: number }[];
}

const dayFormat = new Intl.DateTimeFormat('en-CA', { timeZone: STORE_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

/** `YYYY-MM-DD` of `at` in the store's time zone. */
export const istDay = (at: Date): string => dayFormat.format(at);

/** The last `days` IST calendar days ending with the one containing `now`, oldest first (`YYYY-MM-DD`). */
export function lastDays(now: Date, days: number): string[] {
  const [y, m, d] = istDay(now).split('-').map(Number);
  const anchor = Date.UTC(y, m - 1, d);
  return Array.from({ length: days }, (_, i) => new Date(anchor - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10));
}

/** Midnight IST of a `YYYY-MM-DD` day, as a Date. */
export const istMidnight = (day: string): Date => new Date(`${day}T00:00:00+05:30`);

/**
 * Buckets `{ day, amount }` rows into the fixed day list, filling gaps with 0, and derives today / 7d / 30d
 * from the same buckets so the headline numbers always agree with the bar chart.
 */
export function bucketRevenue(days: string[], rows: { day: string; amount: number }[]): Pick<DashboardDto, 'revenue' | 'revenueByDay'> {
  const byDay = new Map(rows.map((r) => [r.day, r.amount]));
  const series = days.map((day) => ({ date: istMidnight(day).toISOString(), amount: byDay.get(day) ?? 0 }));
  const sum = (n: number) => series.slice(-n).reduce((s, p) => s + p.amount, 0);
  return { revenue: { today: sum(1), d7: sum(7), d30: sum(REVENUE_DAYS) }, revenueByDay: series };
}

/** Oldest of a set of stage-start times, in whole days before `now`; `null` when nothing is in progress. */
export function daysSinceOldest(now: Date, starts: Date[]): number | null {
  if (starts.length === 0) return null;
  const oldest = starts.reduce((min, d) => (d < min ? d : min));
  return Math.floor((now.getTime() - oldest.getTime()) / DAY_MS);
}

/** Honest one-line read of the workshop: real counts only, no invented urgency and no fake capacity percentage. */
export function workshopSummary(ordersInProduction: number, customInProgress: number, oldestDays: number | null): string {
  const total = ordersInProduction + customInProgress;
  if (total === 0) return 'Nothing in the workshop right now.';
  const pieces = `${total} piece${total === 1 ? '' : 's'} in progress`;
  if (oldestDays === null) return `${pieces}.`;
  if (oldestDays <= 0) return `${pieces}, oldest started today.`;
  return `${pieces}, oldest started ${oldestDays} day${oldestDays === 1 ? '' : 's'} ago.`;
}

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly expiry: QuoteExpiryService,
  ) {}

  async get(now: Date = new Date()): Promise<DashboardDto> {
    // Make sure "expiring" and "awaiting customer" reflect quotes that lapsed since anyone last looked.
    await this.expiry.sweep();

    const days = lastDays(now, REVENUE_DAYS);
    const startToday = istMidnight(days[days.length - 1]);
    const startWindow = istMidnight(days[0]);
    const expiringBefore = new Date(now.getTime() + EXPIRING_WITHIN_MS);
    const p = this.prisma;

    const [ordersToday, pendingCod, toQuote, awaitingCustomer, inProgress, revenueRows, lowStockIds, codOrders, packOrders, quoteRequests, counters, expiring, orderStageRows, customStageRows] = await Promise.all([
      // Orders whose payment attempt was never completed are not orders yet.
      p.order.count({ where: { createdAt: { gte: startToday }, status: { not: 'PENDING_PAYMENT' } } }),
      p.order.count({ where: { paymentMethod: 'COD', status: 'PLACED' } }),
      p.customRequest.count({ where: { status: { in: ['REQUESTED', 'UNDER_REVIEW', 'COUNTERED'] } } }),
      p.customRequest.count({ where: { status: 'QUOTED' } }),
      p.customRequest.count({ where: { status: 'IN_PROGRESS' } }),
      // Revenue = paid orders (COD counts once delivered), summed per IST day in the database.
      p.$queryRaw<{ day: string; amount: number }[]>`
        SELECT to_char(("createdAt" AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') AS day, SUM("total")::int AS amount
        FROM "Order"
        WHERE ("paymentStatus" = 'PAID' OR "status" = 'DELIVERED') AND "createdAt" >= ${startWindow}
        GROUP BY 1`,
      p.$queryRaw<{ id: string }[]>`
        SELECT pr."id" FROM "Product" pr LEFT JOIN "ProductVariant" v ON v."productId" = pr."id"
        WHERE pr."status" = 'PUBLISHED' AND pr."fulfilment" = 'READY'
        GROUP BY pr."id" HAVING COALESCE(SUM(v."stock"), 0) <= ${LOW_STOCK_AT}`,
      p.order.findMany({ where: { paymentMethod: 'COD', status: 'PLACED' }, select: { number: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 50 }),
      p.order.findMany({ where: { status: { in: ['CONFIRMED', 'IN_PRODUCTION'] } }, select: { number: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 50 }),
      p.customRequest.findMany({ where: { status: { in: ['REQUESTED', 'UNDER_REVIEW'] } }, select: { number: true, title: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 50 }),
      p.quote.findMany({ where: { status: 'COUNTERED', request: { status: 'COUNTERED' } }, select: { counterAt: true, createdAt: true, request: { select: { number: true } } }, orderBy: { createdAt: 'asc' }, take: 50 }),
      p.quote.findMany({ where: { status: 'SENT', validUntil: { gt: now, lte: expiringBefore }, request: { status: 'QUOTED' } }, select: { createdAt: true, request: { select: { number: true } } }, orderBy: { validUntil: 'asc' }, take: 50 }),
      // Workshop load: orders being made/packed, with the timestamp each first entered that stage (falls back to createdAt if the event is missing).
      p.order.findMany({
        where: { status: { in: PRODUCTION_ORDER_STATUSES } },
        select: { createdAt: true, events: { where: { status: { in: PRODUCTION_ORDER_STATUSES } }, select: { at: true }, orderBy: { at: 'asc' }, take: 1 } },
      }),
      // Workshop load: custom work orders being made right now, same "when did it start" logic.
      p.customRequest.findMany({
        where: { status: 'IN_PROGRESS' },
        select: { createdAt: true, events: { where: { status: 'IN_PROGRESS' }, select: { at: true }, orderBy: { at: 'asc' }, take: 1 } },
      }),
    ]);

    const lowStock = lowStockIds.length === 0 ? [] : await p.product.findMany({ where: { id: { in: lowStockIds.map((r) => r.id) } }, include: PRODUCT_INCLUDE, orderBy: { batch: 'asc' } });

    const needsYou: NeedsYou[] = [
      ...codOrders.map((o): NeedsYou => ({ kind: 'cod', label: `Confirm COD order ${o.number} on WhatsApp`, href: `/admin/orders/${o.number}`, at: o.createdAt.toISOString() })),
      ...quoteRequests.map((r): NeedsYou => ({ kind: 'quote', label: `Quote ${r.number}: ${r.title}`, href: `/admin/custom/${r.number}`, at: r.createdAt.toISOString() })),
      ...counters.map((q): NeedsYou => ({ kind: 'counter', label: `Answer counter on ${q.request.number}`, href: `/admin/custom/${q.request.number}`, at: (q.counterAt ?? q.createdAt).toISOString() })),
      ...expiring.map((q): NeedsYou => ({ kind: 'expiring', label: `Quote on ${q.request.number} expires soon`, href: `/admin/custom/${q.request.number}`, at: q.createdAt.toISOString() })),
      ...packOrders.map((o): NeedsYou => ({ kind: 'pack', label: `${o.number} is waiting to be made or packed`, href: `/admin/orders/${o.number}`, at: o.createdAt.toISOString() })),
    ].sort((a, b) => a.at.localeCompare(b.at));

    const ordersInProduction = orderStageRows.length;
    const customInProgress = customStageRows.length;
    const workshopStarts = [
      ...orderStageRows.map((o) => o.events[0]?.at ?? o.createdAt),
      ...customStageRows.map((c) => c.events[0]?.at ?? c.createdAt),
    ];
    const oldestDays = daysSinceOldest(now, workshopStarts);
    const workshopLoad: WorkshopLoad = { ordersInProduction, customInProgress, oldestDays, summary: workshopSummary(ordersInProduction, customInProgress, oldestDays) };

    return {
      ordersToday,
      ...bucketRevenue(days, revenueRows),
      pendingCod,
      toQuote,
      awaitingCustomer,
      inProgress,
      lowStock: lowStock.map(toProductDto),
      needsYou,
      workshopLoad,
    };
  }
}
