import { randomBytes } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { HashingService, sha256Hex } from '../common/hashing.service.js';
import { conflict, ErrorCode, badRequest, notFound, unauthorized } from '../common/errors.js';
import { normalizePhone } from '../common/phone.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { toUserDto, type UserDto } from '../users/user.mapper.js';
import { TokenService, type IssuedTokens, type SessionMeta } from './token.service.js';
import type { SignupDto } from './dto/auth.dto.js';

const RESET_TTL_MINUTES = 60;
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
  ) {}

  async signup(dto: SignupDto, meta: SessionMeta): Promise<AuthResult> {
    const phone = dto.phone ? normalizePhone(dto.phone) : null;
    const [emailTaken, phoneTaken] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } }),
      phone ? this.prisma.user.findUnique({ where: { phone }, select: { id: true } }) : null,
    ]);
    if (emailTaken) throw conflict('An account with this email already exists. Try logging in.', { email: 'Already registered' }, ErrorCode.EMAIL_TAKEN);
    if (phoneTaken) throw conflict('An account with this phone number already exists. Try logging in.', { phone: 'Already registered' }, ErrorCode.PHONE_TAKEN);

    const passwordHash = await this.hashing.hash(dto.password);
    // Role is never taken from the request: public signup always creates a customer.
    const user = await this.prisma.user.create({ data: { name: dto.name, email: dto.email, phone, passwordHash, role: 'customer' } });
    const tokens = await this.tokens.startSession(user, meta);
    void this.notifications.send('auth.welcome', { to: user.email, name: user.name });
    return { user: toUserDto(user), tokens };
  }

  async login(identifier: string, password: string, meta: SessionMeta): Promise<AuthResult> {
    const id = identifier.trim();
    const where = id.includes('@') ? { email: id.toLowerCase() } : { phone: normalizePhone(id) ?? '\u0000' };
    const user = await this.prisma.user.findUnique({ where });
    if (!user) {
      await this.hashing.burn(password);
      throw unauthorized(INVALID_CREDENTIALS, ErrorCode.INVALID_CREDENTIALS);
    }
    if (!(await this.hashing.verify(user.passwordHash, password))) throw unauthorized(INVALID_CREDENTIALS, ErrorCode.INVALID_CREDENTIALS);

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
      await tx.user.update({ where: { id: row.userId }, data: { passwordHash, tokenVersion: { increment: 1 } } });
      await tx.refreshToken.updateMany({ where: { userId: row.userId, revokedAt: null }, data: { revokedAt: now } });
    });
    this.logger.log(`Password reset for user ${row.userId}`);
  }
}
