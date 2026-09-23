import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { ErrorCode, AppException } from '../errors.js';

const TTL_MS = 24 * 60 * 60 * 1000;
/** An unfinished claim older than this is assumed to be from a crashed request and may be retaken. */
const STALE_LOCK_MS = 60 * 1000;

export interface IdempotentOptions {
  /** Endpoint identity, e.g. "POST /orders". */
  scope: string;
  /** Value of the `Idempotency-Key` header. When undefined the operation simply runs (no replay protection). */
  key: string | undefined;
  userId?: string;
  /** Request body (or any value that defines "the same request"). */
  payload?: unknown;
}

/** Deterministic JSON so key order in the body doesn't change the hash. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().filter((k) => obj[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export const hashRequest = (payload: unknown) => createHash('sha256').update(stableStringify(payload)).digest('hex');

/**
 * `Idempotency-Key` handling for money-moving endpoints (POST /orders, payment verify, accept quote…).
 *
 *   return this.idempotency.run({ scope: 'POST /orders', key, userId, payload: dto }, () => this.orders.place(dto));
 *
 * - first call: claims the key, runs `fn`, stores the JSON result
 * - same key + same payload again: returns the stored result without running `fn`
 * - same key + different payload: 422 IDEMPOTENCY_KEY_REUSED
 * - same key while the first call is still running: 409 IDEMPOTENCY_IN_PROGRESS
 * - `fn` throws: the claim is released so the client can retry with the same key
 * The result must be JSON-serialisable (it is replayed as JSON).
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  async run<T>(opts: IdempotentOptions, fn: () => Promise<T>): Promise<T> {
    if (!opts.key) return fn();

    const requestHash = hashRequest(opts.payload ?? null);
    const claim = await this.claim(opts, requestHash);
    if (claim.replay) return claim.body as T;

    try {
      const result = await fn();
      await this.prisma.idempotencyKey.update({
        where: { id: claim.id },
        data: { completedAt: new Date(), responseStatus: 200, responseBody: toJson(result) },
      });
      return result;
    } catch (err) {
      await this.prisma.idempotencyKey.delete({ where: { id: claim.id } }).catch(() => undefined);
      throw err;
    }
  }

  private async claim(opts: IdempotentOptions, requestHash: string, retried = false): Promise<{ id: string; replay: false } | { replay: true; body: unknown }> {
    const scope = opts.scope;
    const key = opts.key as string;
    try {
      const row = await this.prisma.idempotencyKey.create({
        data: { key, scope, userId: opts.userId, requestHash, expiresAt: new Date(Date.now() + TTL_MS) },
      });
      return { id: row.id, replay: false };
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }

    const existing = await this.prisma.idempotencyKey.findUnique({ where: { scope_key: { scope, key } } });
    if (!existing) {
      if (retried) throw new AppException(409, ErrorCode.IDEMPOTENCY_IN_PROGRESS, 'Please retry in a moment.');
      return this.claim(opts, requestHash, true);
    }
    if (existing.userId !== (opts.userId ?? null) || existing.requestHash !== requestHash) {
      throw new AppException(422, ErrorCode.IDEMPOTENCY_KEY_REUSED, 'That Idempotency-Key was already used for a different request.');
    }
    if (existing.completedAt) return { replay: true, body: existing.responseBody };

    if (Date.now() - existing.lockedAt.getTime() > STALE_LOCK_MS && !retried) {
      this.logger.warn(`Retaking stale idempotency claim ${scope} ${key}`);
      await this.prisma.idempotencyKey.deleteMany({ where: { id: existing.id, completedAt: null } });
      return this.claim(opts, requestHash, true);
    }
    throw new AppException(409, ErrorCode.IDEMPOTENCY_IN_PROGRESS, 'That request is still being processed. Please retry in a moment.');
  }

  /** Housekeeping: call from a cron/admin task. */
  async purgeExpired(): Promise<number> {
    const { count } = await this.prisma.idempotencyKey.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    return count;
  }
}

const toJson = (v: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(v ?? null)) as Prisma.InputJsonValue;
