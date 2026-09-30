import { Injectable } from '@nestjs/common';
import { AppException, ErrorCode } from './errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface ThrottlePolicy {
  /** Failures allowed inside the window before the key locks. */
  maxFailures: number;
  /** A failure older than this no longer counts. */
  windowMs: number;
  /** How long the key stays locked once it trips. */
  lockMs: number;
}

/** Password guessing on one account: five wrong tries in 15 minutes lock it for 15 minutes. */
export const LOGIN_POLICY: ThrottlePolicy = { maxFailures: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
/** Guessing the phone/email behind one order number: ten wrong tries in 15 minutes lock that order's lookup. */
export const TRACK_POLICY: ThrottlePolicy = { maxFailures: 10, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };

/**
 * Failure counters that survive restarts (Postgres, not memory) and are shared by every API process. The per-IP
 * limiter and nginx stop one client hammering; this stops a spread-out guesser going after ONE account or order.
 * Keys are namespaced strings such as `login:maya@example.com` or `track:FB-1001`. Unknown accounts get counters
 * too, so locking never reveals whether an account exists.
 */
@Injectable()
export class AuthThrottleService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws 429 while the key is locked. Call before doing the expensive check. */
  async assertOpen(key: string): Promise<void> {
    const row = await this.prisma.authThrottle.findUnique({ where: { key }, select: { lockedUntil: true } });
    if (row?.lockedUntil && row.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.max(1, Math.ceil((row.lockedUntil.getTime() - Date.now()) / 60_000));
      throw new AppException(429, ErrorCode.RATE_LIMITED, `Too many wrong tries. For safety this is paused: try again in about ${minutes} minute${minutes === 1 ? '' : 's'}, or reset your password.`);
    }
  }

  /** Counts one failure (atomically) and locks the key when it reaches the limit. Returns true when it just locked. */
  async recordFailure(key: string, policy: ThrottlePolicy): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ locked: boolean }[]>`
      INSERT INTO "AuthThrottle" ("key", "failures", "windowStart", "lockedUntil", "updatedAt")
      VALUES (${key}, 1, now(), NULL, now())
      ON CONFLICT ("key") DO UPDATE SET
        "failures" = CASE WHEN "AuthThrottle"."windowStart" < now() - (${policy.windowMs} * interval '1 millisecond') THEN 1 ELSE "AuthThrottle"."failures" + 1 END,
        "windowStart" = CASE WHEN "AuthThrottle"."windowStart" < now() - (${policy.windowMs} * interval '1 millisecond') THEN now() ELSE "AuthThrottle"."windowStart" END,
        "lockedUntil" = CASE
          WHEN (CASE WHEN "AuthThrottle"."windowStart" < now() - (${policy.windowMs} * interval '1 millisecond') THEN 1 ELSE "AuthThrottle"."failures" + 1 END) >= ${policy.maxFailures}
          THEN now() + (${policy.lockMs} * interval '1 millisecond')
          ELSE "AuthThrottle"."lockedUntil" END,
        "updatedAt" = now()
      RETURNING ("lockedUntil" IS NOT NULL AND "lockedUntil" > now()) AS locked`;
    return rows[0]?.locked ?? false;
  }

  /** A correct answer clears the counter. */
  async reset(key: string): Promise<void> {
    await this.prisma.authThrottle.deleteMany({ where: { key } });
  }
}
