import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { isProduction, type Env } from '../config/env.js';

export const GUEST_ORDERS_COOKIE = 'fbf_go';
const MAX_REMEMBERED = 20;
const TTL_DAYS = 7;

/**
 * "Just-placed guest" access. A guest has no account, so the order confirmation page cannot be protected by a
 * login. Instead, placing an order as a guest sets a signed httpOnly cookie (`fbf_go`, path `/orders`, 7 days)
 * listing the order numbers this browser created. `GET /orders/:number` (and cancel / return / pay) for a guest
 * order succeeds only when the cookie lists that number: order numbers are sequential, so "anyone with the
 * number" would be an enumeration hole. Everyone else uses `POST /orders/track` (number + phone/email).
 *
 * Signed with a secret derived from JWT_ACCESS_SECRET (domain-separated) so it can never be replayed as an access token.
 */
@Injectable()
export class GuestAccessService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private get secret(): string {
    return createHash('sha256').update(`guest-orders:${this.config.get('JWT_ACCESS_SECRET', { infer: true })}`).digest('hex');
  }

  /** Order numbers this browser may read as a guest. Bad or expired cookies are simply "none". */
  read(req: Request): string[] {
    const token = (req.cookies as Record<string, string> | undefined)?.[GUEST_ORDERS_COOKIE];
    if (!token) return [];
    try {
      const payload = this.jwt.verify<{ nums?: unknown; typ?: string }>(token, { secret: this.secret });
      if (payload.typ !== 'guest-orders' || !Array.isArray(payload.nums)) return [];
      return payload.nums.filter((n): n is string => typeof n === 'string');
    } catch {
      return [];
    }
  }

  grant(req: Request, res: Response, orderNumber: string): void {
    const nums = [...new Set([...this.read(req), orderNumber])].slice(-MAX_REMEMBERED);
    const token = this.jwt.sign({ typ: 'guest-orders', nums }, { secret: this.secret, expiresIn: `${TTL_DAYS}d` });
    const domain = this.config.get('COOKIE_DOMAIN', { infer: true });
    res.cookie(GUEST_ORDERS_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction({ NODE_ENV: this.config.get('NODE_ENV', { infer: true }) }),
      path: '/orders',
      maxAge: TTL_DAYS * 24 * 60 * 60 * 1000,
      ...(domain ? { domain } : {}),
    });
  }
}
