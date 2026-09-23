import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { safeEqualHex, sha256Hex } from '../common/hashing.service.js';
import { ErrorCode, unauthorized } from '../common/errors.js';
import type { AccessTokenPayload, RefreshTokenPayload } from '../common/types/auth.types.js';
import type { Role } from '../generated/prisma/enums.js';

/**
 * A token rotated less than this long ago being presented again is treated as a benign race (two tabs
 * refreshing at once), not theft: the request is refused but the family survives.
 */
export const REUSE_GRACE_MS = 10_000;

export interface TokenUser {
  id: string;
  role: Role;
  tokenVersion: number;
}

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

export interface IssuedTokens {
  access: string;
  refresh: string;
}

/** Rows this service needs from the DB; a narrow interface keeps the rotation logic unit-testable with a fake. */
export interface RefreshRow {
  id: string;
  userId: string;
  familyId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  get accessTtlMs() {
    return this.config.get('ACCESS_TTL_MINUTES', { infer: true }) * 60_000;
  }
  get refreshTtlMs() {
    return this.config.get('REFRESH_TTL_DAYS', { infer: true }) * 24 * 60 * 60_000;
  }

  signAccess(user: TokenUser): Promise<string> {
    const payload: AccessTokenPayload = { sub: user.id, role: user.role, tv: user.tokenVersion };
    return this.jwt.signAsync(payload, { secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }), expiresIn: Math.floor(this.accessTtlMs / 1000) });
  }

  /** Start a new session (new family). */
  async startSession(user: TokenUser, meta: SessionMeta = {}): Promise<IssuedTokens> {
    return this.issue(user, randomUUID(), meta);
  }

  private async issue(user: TokenUser, familyId: string, meta: SessionMeta, id = randomUUID()): Promise<IssuedTokens> {
    const payload: RefreshTokenPayload = { sub: user.id, fam: familyId, jti: id, tv: user.tokenVersion };
    const refresh = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      expiresIn: Math.floor(this.refreshTtlMs / 1000),
    });
    await this.prisma.refreshToken.create({
      data: { id, userId: user.id, familyId, tokenHash: sha256Hex(refresh), expiresAt: new Date(Date.now() + this.refreshTtlMs), userAgent: meta.userAgent?.slice(0, 255), ip: meta.ip },
    });
    return { access: await this.signAccess(user), refresh };
  }

  /**
   * Rotate a refresh token: the presented token is revoked and replaced by a new one in the same family.
   *  - unknown / bad signature / expired      -> 401 SESSION_EXPIRED
   *  - already rotated or revoked (reuse)     -> family revoked, 401 TOKEN_REUSED (unless within the grace window)
   *  - user's tokenVersion changed            -> family revoked, 401 SESSION_EXPIRED
   */
  async rotate(presented: string, meta: SessionMeta = {}): Promise<IssuedTokens & { userId: string }> {
    const expired = () => unauthorized('Your session has expired. Please log in again.', ErrorCode.SESSION_EXPIRED);

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(presented, { secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }) });
    } catch {
      throw expired();
    }

    const row: RefreshRow | null = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!row || row.userId !== payload.sub || !safeEqualHex(row.tokenHash, sha256Hex(presented))) throw expired();
    if (row.expiresAt.getTime() <= Date.now()) throw expired();

    if (row.revokedAt) {
      const recentlyRotated = row.replacedById !== null && Date.now() - row.revokedAt.getTime() < REUSE_GRACE_MS;
      if (recentlyRotated) throw expired();
      await this.revokeFamily(row.familyId);
      throw unauthorized('Your session was signed out for your security. Please log in again.', ErrorCode.TOKEN_REUSED);
    }

    const user = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { id: true, role: true, tokenVersion: true } });
    if (!user || user.tokenVersion !== payload.tv) {
      await this.revokeFamily(row.familyId);
      throw expired();
    }

    // Atomically claim the token so two concurrent refreshes can't both succeed.
    const newId = randomUUID();
    const claimed = await this.prisma.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date(), replacedById: newId } });
    if (claimed.count !== 1) throw expired();

    const tokens = await this.issue(user, row.familyId, meta, newId);
    return { ...tokens, userId: user.id };
  }

  /** Log out one session: revoke the family the presented token belongs to. Tolerant of garbage tokens. */
  async revokeByToken(presented: string | undefined): Promise<void> {
    if (!presented) return;
    try {
      const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(presented, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        ignoreExpiration: true,
      });
      await this.revokeFamily(payload.fam);
    } catch {
      // Not a token we issued: nothing to revoke.
    }
  }

  revokeFamily(familyId: string) {
    return this.prisma.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Log out everywhere: bump tokenVersion (kills access tokens) and revoke every refresh token. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
  }
}
