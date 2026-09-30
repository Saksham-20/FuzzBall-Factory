import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Runs scheduled work so that at most one copy of a job runs at a time, across overlapping ticks AND across
 * several API processes: a transaction-scoped Postgres advisory lock (`pg_try_advisory_xact_lock`, which releases
 * itself when the transaction ends, so a pooled Prisma connection can never keep a stale lock) guards each name.
 * The job body itself uses the normal pool. Failures are logged, never thrown into the scheduler.
 * Skipped in NODE_ENV=test so e2e runs stay deterministic: tests call the underlying services directly.
 */
@Injectable()
export class JobRunner {
  private readonly logger = new Logger(JobRunner.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Resolves true when the job body ran to completion, false when skipped or failed. */
  async run(name: string, work: () => Promise<unknown>, opts: { force?: boolean; timeoutMs?: number } = {}): Promise<boolean> {
    if (!opts.force && this.config.get('NODE_ENV', { infer: true }) === 'test') return false;
    if (this.running.has(name)) return false;
    this.running.add(name);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const rows = await tx.$queryRaw<{ locked: boolean }[]>`select pg_try_advisory_xact_lock(hashtext(${`fuzzball:job:${name}`})) as locked`;
          if (!rows[0]?.locked) return false; // another process is running it
          await work();
          return true;
        },
        { timeout: opts.timeoutMs ?? 5 * 60_000, maxWait: 5_000 },
      );
    } catch (err) {
      this.logger.error(`Job ${name} failed: ${(err as Error).message}`);
      return false;
    } finally {
      this.running.delete(name);
    }
  }
}
