import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailTokenService } from '../auth/email-token.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { TokenService, type IssuedTokens, type SessionMeta } from '../auth/token.service.js';
import { badRequest, conflict, ErrorCode, notFound, validationFailed } from '../common/errors.js';
import { HashingService } from '../common/hashing.service.js';
import { toUserDto, type UserDto } from '../users/user.mapper.js';
import { addressFieldErrors } from '../shipping/address-validation.js';
import { toAddressDto, type AddressDto } from './address.mapper.js';
import type { ChangeEmailDto, ChangePasswordDto, SaveAddressDto, UpdateProfileDto } from './dto/account.dto.js';

const MAX_ADDRESSES = 20;

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly tokens: TokenService,
    private readonly emailTokens: EmailTokenService,
    private readonly notifications: NotificationsService,
  ) {}

  // ───────────── profile ─────────────

  async getProfile(userId: string): Promise<UserDto> {
    const u = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw notFound('Account not found.');
    return toUserDto(u);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDto> {
    const current = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!current) throw notFound('Account not found.');

    if (dto.email && dto.email !== current.email) {
      throw validationFailed({ email: 'To change your email, use "Change email": we confirm the new address first' });
    }
    const phone = dto.phone === undefined ? undefined : dto.phone; // null clears it
    const phoneChanged = phone !== undefined && phone !== current.phone;

    if (phoneChanged) {
      // The phone number is a login and a contact for shipping: moving it needs proof it is really the owner.
      if (!current.emailVerified) throw badRequest('Confirm your email address first, then you can change your phone number.', undefined, ErrorCode.EMAIL_NOT_VERIFIED);
      if (!dto.currentPassword || !(await this.hashing.verify(current.passwordHash, dto.currentPassword))) {
        throw badRequest('Enter your current password to change your phone number.', { currentPassword: 'Incorrect' }, ErrorCode.INVALID_CREDENTIALS);
      }
      if (phone) {
        const taken = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
        if (taken) throw conflict('An account with this phone number already exists.', { phone: 'Already registered' }, ErrorCode.PHONE_TAKEN);
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { ...(dto.name ? { name: dto.name } : {}), ...(phoneChanged ? { phone, phoneVerified: false } : {}) },
    });
    if (phoneChanged) {
      await this.prisma.auditLog.create({ data: { actorId: userId, action: 'account.phone_change', entity: 'User', entityId: userId } });
    }
    return toUserDto(updated);
  }

  /**
   * Starts an email change: needs the password and an already verified current address. The confirm link goes to the
   * NEW address and a notice goes to the old one; the account only moves when the new address's owner clicks.
   */
  async requestEmailChange(userId: string, dto: ChangeEmailDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound('Account not found.');
    if (!(await this.hashing.verify(user.passwordHash, dto.password))) {
      throw badRequest("That password isn't right.", { password: 'Incorrect' }, ErrorCode.INVALID_CREDENTIALS);
    }
    if (!user.emailVerified) throw badRequest('Confirm your current email address first, then you can change it.', undefined, ErrorCode.EMAIL_NOT_VERIFIED);
    if (dto.email === user.email) throw validationFailed({ email: 'That is already your email' });
    const taken = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (taken) throw conflict('An account with this email already exists.', { email: 'Already registered' }, ErrorCode.EMAIL_TAKEN);

    const { token, expiresInMinutes } = await this.emailTokens.issue(userId, 'CHANGE', dto.email);
    await this.notifications.send('auth.confirm_email_change', { to: dto.email, name: user.name, confirmUrl: this.emailTokens.link('/verify-email', token), expiresInMinutes });
    await this.notifications.send('auth.email_change_notice', { to: user.email, name: user.name, newEmail: dto.email });
    await this.prisma.auditLog.create({ data: { actorId: userId, action: 'account.email_change_request', entity: 'User', entityId: userId } });
  }

  /**
   * Verify the current password, store the new one, and sign out every OTHER device: `revokeAllForUser` bumps
   * `tokenVersion` and revokes all refresh tokens, so this device is given a fresh session (returned tokens) and
   * the controller sets its cookies.
   */
  async changePassword(userId: string, dto: ChangePasswordDto, meta: SessionMeta): Promise<IssuedTokens> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound('Account not found.');
    if (!(await this.hashing.verify(user.passwordHash, dto.current))) {
      throw badRequest("Your current password isn't right.", { current: 'Incorrect' }, ErrorCode.INVALID_CREDENTIALS);
    }
    if (dto.next === dto.current) throw validationFailed({ next: 'Choose a different password' });

    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await this.hashing.hash(dto.next) } });
    await this.tokens.revokeAllForUser(userId);
    const fresh = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, role: true, tokenVersion: true } });
    this.logger.log(`Password changed for user ${userId}`);
    return this.tokens.startSession(fresh, meta);
  }

  // ───────────── addresses ─────────────

  async listAddresses(userId: string): Promise<AddressDto[]> {
    const rows = await this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
    return rows.map(toAddressDto);
  }

  async createAddress(userId: string, dto: SaveAddressDto): Promise<AddressDto> {
    this.validate(dto);
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId } });
      if (count >= MAX_ADDRESSES) throw badRequest(`You can save up to ${MAX_ADDRESSES} addresses. Remove one first.`);
      const makeDefault = !!dto.isDefault || count === 0;
      if (makeDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      const row = await tx.address.create({ data: { ...this.data(dto), userId, isDefault: makeDefault } });
      return toAddressDto(row);
    });
  }

  async updateAddress(userId: string, id: string, dto: SaveAddressDto): Promise<AddressDto> {
    this.validate(dto);
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({ where: { id, userId } });
      if (!existing) throw notFound("We couldn't find that address.");
      // Making one default clears the others; an address can't stop being the default by itself (pick another one).
      const makeDefault = dto.isDefault === true || existing.isDefault;
      if (makeDefault && !existing.isDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      const row = await tx.address.update({ where: { id }, data: { ...this.data(dto), isDefault: makeDefault } });
      return toAddressDto(row);
    });
  }

  async deleteAddress(userId: string, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({ where: { id, userId } });
      if (!existing) return; // idempotent: deleting something that is gone (or isn't yours) is a no-op, like the web mock
      await tx.address.delete({ where: { id } });
      if (existing.isDefault) {
        const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { id: true } });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
  }

  private validate(dto: SaveAddressDto) {
    const fields = addressFieldErrors(dto);
    if (Object.keys(fields).length) throw validationFailed(fields);
  }

  private data(dto: SaveAddressDto) {
    return { label: dto.label, name: dto.name, phone: dto.phone, line1: dto.line1, line2: dto.line2 || null, city: dto.city, state: dto.state, postalCode: dto.postalCode, country: dto.country };
  }

  // ───────────── DPDP deletion request ─────────────

  /**
   * DPDP Act: records the request (timestamp on the user + an AuditLog row). Thirty days later the erasure job
   * anonymises the account (see `ErasureService`); until then the customer can change their mind (`cancelDeletion`).
   */
  async requestDeletion(userId: string, ip?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { deletionRequestedAt: true, erasedAt: true } });
      if (!user || user.erasedAt) throw notFound('Account not found.');
      if (!user.deletionRequestedAt) await tx.user.update({ where: { id: userId }, data: { deletionRequestedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'account.delete_request', entity: 'User', entityId: userId, ip, meta: { repeated: !!user.deletionRequestedAt } } });
    });
  }

  /** Withdraws a pending deletion request. A no-op when there is none. */
  async cancelDeletion(userId: string, ip?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { deletionRequestedAt: true, erasedAt: true } });
      if (!user || user.erasedAt) throw notFound('Account not found.');
      if (!user.deletionRequestedAt) return;
      await tx.user.update({ where: { id: userId }, data: { deletionRequestedAt: null } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'account.delete_cancel', entity: 'User', entityId: userId, ip } });
    });
  }
}
