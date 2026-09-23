import { Injectable } from '@nestjs/common';
import { conflict, notFound, validationFailed } from '../common/errors.js';
import type { Coupon } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminCtx } from './admin-custom.service.js';
import { AuditService } from './audit.service.js';
import type { CouponInputDto } from './dto/coupon.dto.js';

/** Wire shape: web `Coupon`. */
export interface CouponDto {
  code: string;
  kind: 'PERCENT' | 'FLAT';
  value: number;
  minCart: number;
  active: boolean;
  uses: number;
  expiresAt?: string;
}

export const toCouponDto = (c: Coupon): CouponDto => ({
  code: c.code,
  kind: c.kind,
  value: c.value,
  minCart: c.minCart,
  active: c.active,
  uses: c.uses,
  ...(c.expiresAt ? { expiresAt: c.expiresAt.toISOString() } : {}),
});

/** Business checks that depend on more than one field. */
export function checkCoupon(dto: Pick<CouponInputDto, 'kind' | 'value' | 'expiresAt'>): Record<string, string> {
  const fields: Record<string, string> = {};
  if (dto.kind === 'PERCENT' && dto.value > 100) fields.value = 'A percentage cannot be more than 100';
  if (dto.expiresAt && Number.isNaN(new Date(dto.expiresAt).getTime())) fields.expiresAt = 'Use an ISO date like 2026-12-31';
  return fields;
}

@Injectable()
export class AdminCouponsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<CouponDto[]> {
    return (await this.prisma.coupon.findMany({ orderBy: { createdAt: 'asc' } })).map(toCouponDto);
  }

  async create(ctx: AdminCtx, dto: CouponInputDto): Promise<CouponDto> {
    const fields = checkCoupon(dto);
    if (Object.keys(fields).length > 0) throw validationFailed(fields);
    return this.prisma.$transaction(async (tx) => {
      if (await tx.coupon.findUnique({ where: { code: dto.code }, select: { id: true } })) throw conflict('That coupon code already exists.', { code: 'Already used' });
      const row = await tx.coupon.create({ data: this.data(dto) });
      await this.audit.log({ actorId: ctx.actorId, action: 'coupon.create', entity: 'Coupon', entityId: row.id, meta: { code: row.code }, ip: ctx.ip }, tx);
      return toCouponDto(row);
    });
  }

  /** Upsert by code (the web's `saveCoupon`). `uses` is a counter and is never overwritten. */
  async save(ctx: AdminCtx, code: string, dto: CouponInputDto): Promise<CouponDto> {
    if (dto.code !== code.trim().toUpperCase()) throw validationFailed({ code: 'The code cannot be changed' });
    const fields = checkCoupon(dto);
    if (Object.keys(fields).length > 0) throw validationFailed(fields);
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.coupon.upsert({ where: { code: dto.code }, update: this.data(dto), create: this.data(dto) });
      await this.audit.log({ actorId: ctx.actorId, action: 'coupon.save', entity: 'Coupon', entityId: row.id, meta: { code: row.code, active: row.active }, ip: ctx.ip }, tx);
      return toCouponDto(row);
    });
  }

  async remove(ctx: AdminCtx, code: string): Promise<void> {
    const normalised = code.trim().toUpperCase();
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.coupon.findUnique({ where: { code: normalised }, select: { id: true } });
      if (!row) throw notFound('Coupon not found.');
      await tx.coupon.delete({ where: { id: row.id } });
      await this.audit.log({ actorId: ctx.actorId, action: 'coupon.delete', entity: 'Coupon', entityId: row.id, meta: { code: normalised }, ip: ctx.ip }, tx);
    });
  }

  private data(dto: CouponInputDto) {
    return { code: dto.code, kind: dto.kind, value: dto.value, minCart: dto.minCart, active: dto.active, expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null };
  }
}
