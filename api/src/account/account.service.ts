import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { TokenService, type IssuedTokens, type SessionMeta } from '../auth/token.service.js';
import { badRequest, conflict, ErrorCode, notFound, validationFailed } from '../common/errors.js';
import { HashingService } from '../common/hashing.service.js';
import { toUserDto, type UserDto } from '../users/user.mapper.js';
import { addressFieldErrors } from '../shipping/address-validation.js';
import { toAddressDto, type AddressDto } from './address.mapper.js';
import type { ChangePasswordDto, SaveAddressDto, UpdateProfileDto } from './dto/account.dto.js';

const MAX_ADDRESSES = 20;

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
    private readonly tokens: TokenService,
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

    const email = dto.email && dto.email !== current.email ? dto.email : undefined;
    const phone = dto.phone === undefined ? undefined : dto.phone; // null clears it
    const phoneChanged = phone !== undefined && phone !== current.phone;

    if (email) {
      const taken = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (taken) throw conflict('An account with this email already exists.', { email: 'Already registered' }, ErrorCode.EMAIL_TAKEN);
    }
    if (phoneChanged && phone) {
      const taken = await this.prisma.user.findUnique({ where: { phone }, select: { id: true } });
      if (taken) throw conflict('An account with this phone number already exists.', { phone: 'Already registered' }, ErrorCode.PHONE_TAKEN);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(email ? { email, emailVerified: false } : {}),
        ...(phoneChanged ? { phone, phoneVerified: false } : {}),
      },
    });
    return toUserDto(updated);
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
   * DPDP Act: records the request (timestamp on the user + an AuditLog row) so it can be fulfilled within 30 days.
   * The account is not deleted here: orders must be retained for tax and dispute purposes, so the maker handles it.
   */
  async requestDeletion(userId: string, ip?: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { deletionRequestedAt: true } });
      if (!user) throw notFound('Account not found.');
      if (!user.deletionRequestedAt) await tx.user.update({ where: { id: userId }, data: { deletionRequestedAt: new Date() } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'account.delete_request', entity: 'User', entityId: userId, ip, meta: { repeated: !!user.deletionRequestedAt } } });
    });
  }
}
