import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sha256Hex } from '../common/hashing.service.js';
import type { Env } from '../config/env.js';
import type { EmailTokenPurpose } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Minutes a link works. A signup link is patient (people read mail later); an email-change link is not. */
export const EMAIL_TOKEN_TTL_MINUTES: Record<EmailTokenPurpose, number> = { VERIFY: 24 * 60, CHANGE: 60 };

export interface ClaimedEmailToken {
  id: string;
  userId: string;
  purpose: EmailTokenPurpose;
  email: string;
}

/** One-time emailed links (verify an address, confirm a new one). Only the SHA-256 of a token is stored. */
@Injectable()
export class EmailTokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Replaces any unused token of the same kind for this user, so only the newest link works. */
  async issue(userId: string, purpose: EmailTokenPurpose, email: string): Promise<{ token: string; expiresInMinutes: number }> {
    const token = randomBytes(32).toString('base64url');
    const expiresInMinutes = EMAIL_TOKEN_TTL_MINUTES[purpose];
    await this.prisma.$transaction([
      this.prisma.emailToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
      this.prisma.emailToken.create({ data: { userId, purpose, email, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + expiresInMinutes * 60_000) } }),
    ]);
    return { token, expiresInMinutes };
  }

  /** Marks a valid, unused, unexpired token used and returns it; null for anything else. Two clicks: one wins. */
  async claim(token: string): Promise<ClaimedEmailToken | null> {
    const row = await this.prisma.emailToken.findUnique({ where: { tokenHash: sha256Hex(token) } });
    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
    const claimed = await this.prisma.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
    return claimed.count === 1 ? { id: row.id, userId: row.userId, purpose: row.purpose, email: row.email } : null;
  }

  /** Absolute link into the storefront, e.g. `link('/verify-email', token)`. */
  link(path: string, token: string): string {
    const origin = this.config.get('WEB_ORIGIN', { infer: true }).split(',')[0]!.trim().replace(/\/$/, '');
    return `${origin}${path}?token=${encodeURIComponent(token)}`;
  }
}
