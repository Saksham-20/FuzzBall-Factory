import { Injectable } from '@nestjs/common';
import { notFound } from '../common/errors.js';
import type { Material } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminCtx } from './admin-custom.service.js';
import { AuditService } from './audit.service.js';
import type { MaterialInputDto, MaterialStockAdjustDto } from './dto/material.dto.js';

/** Wire shape: web `Material`. */
export interface MaterialDto {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
  qtyOnHand: number;
  lowStockAt?: number;
  notes?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export const toMaterialDto = (m: Material): MaterialDto => ({
  id: m.id,
  name: m.name,
  unit: m.unit,
  costPerUnit: m.costPerUnit,
  qtyOnHand: m.qtyOnHand,
  ...(m.lowStockAt != null ? { lowStockAt: m.lowStockAt } : {}),
  ...(m.notes ? { notes: m.notes } : {}),
  archived: m.archived,
  createdAt: m.createdAt.toISOString(),
  updatedAt: m.updatedAt.toISOString(),
});

@Injectable()
export class AdminMaterialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** Non-archived only: the admin list and the price calculator's picker both want only what's still stocked. */
  async list(): Promise<MaterialDto[]> {
    return (await this.prisma.material.findMany({ where: { archived: false }, orderBy: { createdAt: 'asc' } })).map(toMaterialDto);
  }

  async create(ctx: AdminCtx, dto: MaterialInputDto): Promise<MaterialDto> {
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.material.create({ data: this.data(dto) });
      await this.audit.log({ actorId: ctx.actorId, action: 'material.create', entity: 'Material', entityId: row.id, meta: { name: row.name }, ip: ctx.ip }, tx);
      return toMaterialDto(row);
    });
  }

  async update(ctx: AdminCtx, id: string, dto: MaterialInputDto): Promise<MaterialDto> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.material.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw notFound('Material not found.');
      const row = await tx.material.update({ where: { id }, data: this.data(dto) });
      await this.audit.log({ actorId: ctx.actorId, action: 'material.update', entity: 'Material', entityId: row.id, meta: { name: row.name }, ip: ctx.ip }, tx);
      return toMaterialDto(row);
    });
  }

  /** Soft delete: hides it from `list()` from then on. Past usage already logged isn't affected. Archiving an already-archived (or unknown) id is a 404, same as deleting a gone row. */
  async archive(ctx: AdminCtx, id: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.material.findUnique({ where: { id }, select: { id: true, name: true, archived: true } });
      if (!existing || existing.archived) throw notFound('Material not found.');
      await tx.material.update({ where: { id }, data: { archived: true } });
      await this.audit.log({ actorId: ctx.actorId, action: 'material.archive', entity: 'Material', entityId: id, meta: { name: existing.name }, ip: ctx.ip }, tx);
    });
  }

  /** Changes `qtyOnHand` by `dto.delta` (negative to record material used on a piece). */
  async adjustStock(ctx: AdminCtx, id: string, dto: MaterialStockAdjustDto): Promise<MaterialDto> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.material.findUnique({ where: { id } });
      if (!existing) throw notFound('Material not found.');
      const qtyOnHand = Math.round((existing.qtyOnHand + dto.delta) * 1000) / 1000;
      const row = await tx.material.update({ where: { id }, data: { qtyOnHand } });
      await this.audit.log(
        { actorId: ctx.actorId, action: 'material.adjust-stock', entity: 'Material', entityId: id, meta: { name: existing.name, delta: dto.delta, reason: dto.reason ?? null, qtyOnHand }, ip: ctx.ip },
        tx,
      );
      return toMaterialDto(row);
    });
  }

  private data(dto: MaterialInputDto) {
    return {
      name: dto.name,
      unit: dto.unit,
      costPerUnit: dto.costPerUnit,
      qtyOnHand: dto.qtyOnHand,
      lowStockAt: dto.lowStockAt ?? null,
      notes: dto.notes || null,
      ...(dto.archived !== undefined ? { archived: dto.archived } : {}),
    };
  }
}
