import { Injectable } from '@nestjs/common';
import { AppException } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CustomStateService } from './custom-state.service.js';

/**
 * A quote is valid for `quoteValidityDays`. Reads never write: a scheduled job (`custom.expire-quotes`) calls
 * `sweep()` every few minutes, and every action that depends on the quote (accept, counter, pay) calls `expire()`
 * first, so a lapsed quote can never be acted on even between two sweeps.
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

  /** Expires every overdue quote. Returns how many work orders moved. */
  async sweep(): Promise<number> {
    const due = await this.prisma.customRequest.findMany({
      where: { status: 'QUOTED', quotes: { some: { status: 'SENT', validUntil: { lt: new Date() } } } },
      select: { id: true },
      take: 200,
    });
    let moved = 0;
    for (const r of due) if (await this.expire(r.id)) moved += 1;
    return moved;
  }
}
