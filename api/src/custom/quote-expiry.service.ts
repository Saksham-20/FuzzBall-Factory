import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CustomStateService } from './custom-state.service.js';

/**
 * A quote is valid for `quoteValidityDays`. Expiry is applied lazily (whenever a work order is read or acted
 * on) and in bulk by `sweep()` (called from the admin dashboard/list). `@nestjs/schedule` is not installed,
 * so there is no cron; nothing depends on one because the lazy path always runs before any decision.
 */
@Injectable()
export class QuoteExpiryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: CustomStateService,
  ) {}

  /** Expires the request's overdue open quote and moves QUOTED → EXPIRED. Returns whether it did. */
  async expire(requestId: string): Promise<boolean> {
    try {
      return await this.state.withTransaction(async (tx, collect) => {
        const { count } = await tx.quote.updateMany({ where: { requestId, status: 'SENT', validUntil: { lt: new Date() } }, data: { status: 'EXPIRED' } });
        if (count === 0) return false;
        collect(await this.state.move(tx, requestId, [{ to: 'EXPIRED', note: 'The quote expired.' }], { notify: false }));
        return true;
      });
    } catch (err) {
      // Someone else moved the work order first: nothing left for us to expire.
      if (err instanceof AppException && (err.code === 'CONFLICT' || err.code === 'INVALID_TRANSITION')) return false;
      throw err;
    }
  }

  /** Cheap check on an already loaded request. */
  async expireIfDue(row: { id: string; status: string; quotes: { status: string; validUntil: Date }[] }): Promise<boolean> {
    if (row.status !== 'QUOTED') return false;
    const now = Date.now();
    if (!row.quotes.some((q) => q.status === 'SENT' && q.validUntil.getTime() < now)) return false;
    return this.expire(row.id);
  }

  /** Expires every overdue quote (optionally for one customer). Returns how many work orders moved. */
  async sweep(userId?: string): Promise<number> {
    const due = await this.prisma.customRequest.findMany({
      where: { status: 'QUOTED', ...(userId ? { userId } : {}), quotes: { some: { status: 'SENT', validUntil: { lt: new Date() } } } },
      select: { id: true },
      take: 200,
    });
    let moved = 0;
    for (const r of due) if (await this.expire(r.id)) moved += 1;
    return moved;
  }
}
