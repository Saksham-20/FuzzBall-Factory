import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthThrottleService, LOGIN_POLICY } from '../common/auth-throttle.service.js';
import { HashingService, sha256Hex } from '../common/hashing.service.js';
import { conflict, ErrorCode, badRequest, notFound, unauthorized } from '../common/errors.js';
import { normalizePhone } from '../common/phone.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { toUserDto, type UserDto } from '../users/user.mapper.js';
import { EmailTokenService } from './email-token.service.js';
import { TokenService, type IssuedTokens, type SessionMeta } from './token.service.js';
import type { SignupDto } from './dto/auth.dto.js';

const RESET_TTL_MINUTES = 60;
/** Throttle key for password guesses against one typed account (lowercased email or normalised phone). */
export const loginKey = (account: string) => `login:${account.slice(0, 120)}`;
const INVALID_CREDENTIALS = "That email/phone and password don't match. Try again or reset your password.";

export interface AuthResult {
  user: UserDto;
  tokens: IssuedTokens;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly tokens: TokenService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
    private readonly emailTokens: EmailTokenService,
    private readonly throttle: AuthThrottleService,
  ) {}

  async signup(dto: SignupDto, meta: SessionMeta): Promise<AuthResult> {
    const phone = dto.phone ? normalizePhone(dto.phone) : null;
    const [existing, phoneTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email } }),
      phone ? this.prisma.user.findUnique({ where: { phone }, select: { id: true } }) : null,
    ]);
    // An unverified, empty account cannot hold an address hostage: whoever signs up with it next takes it over (the
    // real owner proves themselves with the emailed link). Anything with history is only reachable by login or reset.
    const takeover = existing && (await this.isAbandoned(existing)) ? existing : null;
    if (existing && !takeover) throw conflict('An account with this email already exists. Try logging in.', { email: 'Already registered' }, ErrorCode.EMAIL_TAKEN);
    if (phoneTaken && phoneTaken.id !== takeover?.id) throw conflict('An account with this phone number already exists. Try logging in.', { phone: 'Already registered' }, ErrorCode.PHONE_TAKEN);

    const passwordHash = await this.hashing.hash(dto.password);
    let user;
    if (takeover) {
      user = await this.prisma.user.update({ where: { id: takeover.id }, data: { name: dto.name, phone, passwordHash } });
      await this.tokens.revokeAllForUser(user.id); // whoever held the old password is signed out
      user = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    } else {
      // Role is never taken from the request: public signup always creates a customer.
      user = await this.prisma.user.create({ data: { name: dto.name, email: dto.email, phone, passwordHash, role: 'customer' } });
    }
    const tokens = await this.tokens.startSession(user, meta);
    void this.notifications.send('auth.welcome', { to: user.email, name: user.name });
    await this.sendVerification(user);
    return { user: toUserDto(user), tokens };
  }

  /** Unverified customer account nobody has used for anything. */
  private async isAbandoned(user: { id: string; role: string; emailVerified: boolean }): Promise<boolean> {
    if (user.emailVerified || user.role !== 'customer') return false;
    const [orders, requests, reviews, addresses] = await Promise.all([
      this.prisma.order.count({ where: { userId: user.id } }),
      this.prisma.customRequest.count({ where: { userId: user.id } }),
      this.prisma.review.count({ where: { userId: user.id } }),
      this.prisma.address.count({ where: { userId: user.id } }),
    ]);
    return orders + requests + reviews + addresses === 0;
  }

  private async sendVerification(user: { id: string; email: string; name: string }): Promise<void> {
    const { token, expiresInMinutes } = await this.emailTokens.issue(user.id, 'VERIFY', user.email);
    void this.notifications.send('auth.verify_email', { to: user.email, name: user.name, verifyUrl: this.emailTokens.link('/verify-email', token), expiresInMinutes });
  }

  /** Re-sends the signup link. Quietly does nothing for an already verified account. */
  async resendVerification(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.emailVerified) return;
    await this.sendVerification(user);
  }

  /**
   * Consumes a link from `auth.verify_email` (marks the address verified) or `auth.confirm_email_change` (moves the
   * account to the new address and signs every device out). The link is the proof: no session is needed.
   */
  async verifyEmail(token: string): Promise<{ purpose: 'VERIFY' | 'CHANGE' }> {
    const invalid = () => badRequest('This link is invalid or has expired. Request a new one from your account.', undefined, ErrorCode.INVALID_EMAIL_TOKEN);
    const claimed = await this.emailTokens.claim(token);
    if (!claimed) throw invalid();
    const user = await this.prisma.user.findUnique({ where: { id: claimed.userId }, select: { id: true, email: true } });
    if (!user) throw invalid();

    if (claimed.purpose === 'VERIFY') {
      if (user.email !== claimed.email) throw invalid(); // the address changed since this link was sent
      await this.prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
      return { purpose: 'VERIFY' };
    }
    try {
      await this.prisma.user.update({ where: { id: user.id }, data: { email: claimed.email, emailVerified: true } });
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') throw conflict('That email now belongs to another account.', { email: 'Already registered' }, ErrorCode.EMAIL_TAKEN);
      throw err;
    }
    await this.tokens.revokeAllForUser(user.id);
    return { purpose: 'CHANGE' };
  }

  async login(identifier: string, password: string, meta: SessionMeta): Promise<AuthResult> {
    const id = identifier.trim();
    const phone = id.includes('@') ? null : normalizePhone(id);
    const where = id.includes('@') ? { email: id.toLowerCase() } : { phone: phone ?? '\u0000' };
    // One counter per typed account (known or not, so a lock never reveals whether the account exists).
    const key = loginKey(id.includes('@') ? id.toLowerCase() : (phone ?? id));
    await this.throttle.assertOpen(key);

    const user = await this.prisma.user.findUnique({ where });
    if (!user) {
      await this.hashing.burn(password);
      await this.throttle.recordFailure(key, LOGIN_POLICY);
      throw unauthorized(INVALID_CREDENTIALS, ErrorCode.INVALID_CREDENTIALS);
    }
    if (!(await this.hashing.verify(user.passwordHash, password))) {
      await this.throttle.recordFailure(key, LOGIN_POLICY);
      throw unauthorized(INVALID_CREDENTIALS, ErrorCode.INVALID_CREDENTIALS);
    }
    await this.throttle.reset(key);

    if (this.hashing.needsRehash(user.passwordHash)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await this.hashing.hash(password) } });
    }
    const tokens = await this.tokens.startSession(user, meta);
    return { user: toUserDto(user), tokens };
  }

  async refresh(presented: string | undefined, meta: SessionMeta): Promise<AuthResult> {
    if (!presented) throw unauthorized('Your session has expired. Please log in again.', ErrorCode.SESSION_EXPIRED);
    const { userId, ...tokens } = await this.tokens.rotate(presented, meta);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return { user: toUserDto(user), tokens };
  }

  logout(refreshToken: string | undefined) {
    return this.tokens.revokeByToken(refreshToken);
  }

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound('Account not found.');
    return toUserDto(user);
  }

  /** Always resolves the same way, so account existence never leaks. The email is sent fire-and-forget. */
  async forgot(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
      this.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: sha256Hex(token), expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000) },
      }),
    ]);
    const origin = this.config.get('WEB_ORIGIN', { infer: true }).split(',')[0].trim().replace(/\/$/, '');
    void this.notifications.send('auth.password_reset', {
      to: user.email,
      name: user.name,
      resetUrl: `${origin}/reset-password?token=${encodeURIComponent(token)}`,
      expiresInMinutes: RESET_TTL_MINUTES,
    });
  }

  async reset(token: string, password: string): Promise<void> {
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256Hex(token) } });
    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) {
      throw badRequest('This reset link is invalid or has expired. Please request a new one.', undefined, ErrorCode.INVALID_RESET_TOKEN);
    }
    const passwordHash = await this.hashing.hash(password);
    const now = new Date();
    // One transaction: claim the token, set the password, kill every session.
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
      if (claimed.count !== 1) throw badRequest('This reset link is invalid or has expired. Please request a new one.', undefined, ErrorCode.INVALID_RESET_TOKEN);
      // Clicking the reset link proves the inbox belongs to whoever did it, so the address counts as verified.
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash, emailVerified: true, tokenVersion: { increment: 1 } } });
      await tx.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: now } });
    });
    // Proving the inbox also lifts a guessing lockout on this account.
    const owner = await this.prisma.user.findUnique({ where: { id: row.userId }, select: { email: true, phone: true } });
    if (owner) await Promise.all([this.throttle.reset(loginKey(owner.email)), ...(owner.phone ? [this.throttle.reset(loginKey(owner.phone))] : [])]);
    this.logger.log(`Password reset for user ${row.userId}`);
  }
}
