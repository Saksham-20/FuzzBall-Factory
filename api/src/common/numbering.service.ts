import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';

type Db = PrismaService | Prisma.TransactionClient;

/** First number handed out per counter is `base + 1`. */
export const COUNTERS = {
  order: { key: 'order', base: 1000 },
  workOrder: { key: 'work_order', base: 0 },
} as const;

export const formatOrderNumber = (n: number) => `FB-${n}`;
export const formatWorkOrderNumber = (n: number) => `WO-${String(n).padStart(3, '0')}`;

/**
 * Human-readable sequential numbers (FB-1001, WO-001) from the `Counter` table.
 *
 * One atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING`. Pass the transaction client when creating the
 * order/work order so the increment commits or rolls back with it (the row lock serialises concurrent
 * creators and leaves no gaps). Never compute "max + 1" in application code.
 */
@Injectable()
export class NumberingService {
  constructor(private readonly prisma: PrismaService) {}

  private async next(counter: { key: string; base: number }, db: Db): Promise<number> {
    const rows = await db.$queryRaw<{ value: number }[]>`
      INSERT INTO "Counter" ("key", "value") VALUES (${counter.key}, ${counter.base + 1})
      ON CONFLICT ("key") DO UPDATE SET "value" = "Counter"."value" + 1
      RETURNING "value"`;
    return Number(rows[0].value);
  }

  async nextOrderNumber(db: Db = this.prisma): Promise<string> {
    return formatOrderNumber(await this.next(COUNTERS.order, db));
  }

  async nextWorkOrderNumber(db: Db = this.prisma): Promise<string> {
    return formatWorkOrderNumber(await this.next(COUNTERS.workOrder, db));
  }
}
