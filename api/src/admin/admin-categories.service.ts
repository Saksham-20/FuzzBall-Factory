import { Injectable } from '@nestjs/common';
import { conflict, notFound, validationFailed } from '../common/errors.js';
import { toCategoryDto, type CategoryDto } from '../catalog/product.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminCtx } from './admin-custom.service.js';
import { AuditService } from './audit.service.js';
import type { CategoryInputDto } from './dto/category.dto.js';

@Injectable()
export class AdminCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    return rows.map(toCategoryDto);
  }

  /** Strict create: 409 when the slug is taken. */
  async create(ctx: AdminCtx, dto: CategoryInputDto): Promise<CategoryDto> {
    return this.prisma.$transaction(async (tx) => {
      if (await tx.category.findUnique({ where: { slug: dto.slug }, select: { id: true } })) throw conflict('A category with that slug already exists.', { slug: 'Already used' });
      const last = await tx.category.aggregate({ _max: { sortOrder: true } });
      const row = await tx.category.create({ data: { ...this.data(dto), slug: dto.slug, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
      await this.audit.log({ actorId: ctx.actorId, action: 'category.create', entity: 'Category', entityId: row.id, meta: { slug: row.slug }, ip: ctx.ip }, tx);
      return toCategoryDto(row);
    });
  }

  /** Upsert by slug (the web's `saveCategory`). The slug is the key and never changes. */
  async save(ctx: AdminCtx, slug: string, dto: CategoryInputDto): Promise<CategoryDto> {
    if (dto.slug !== slug) throw validationFailed({ slug: 'The slug cannot be changed' });
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.category.findUnique({ where: { slug }, select: { id: true } });
      let row;
      if (existing) row = await tx.category.update({ where: { slug }, data: this.data(dto) });
      else {
        const last = await tx.category.aggregate({ _max: { sortOrder: true } });
        row = await tx.category.create({ data: { ...this.data(dto), slug, sortOrder: (last._max.sortOrder ?? -1) + 1 } });
      }
      await this.audit.log({ actorId: ctx.actorId, action: existing ? 'category.update' : 'category.create', entity: 'Category', entityId: row.id, meta: { slug }, ip: ctx.ip }, tx);
      return toCategoryDto(row);
    });
  }

  /** Blocked while any product (even an archived one) still sits in the category. */
  async remove(ctx: AdminCtx, slug: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.category.findUnique({ where: { slug }, select: { id: true, _count: { select: { products: true } } } });
      if (!row) throw notFound('Category not found.');
      if (row._count.products > 0) throw conflict('Move or archive the products in this category first.');
      await tx.category.delete({ where: { id: row.id } });
      await this.audit.log({ actorId: ctx.actorId, action: 'category.delete', entity: 'Category', entityId: row.id, meta: { slug }, ip: ctx.ip }, tx);
    });
  }

  private data(dto: CategoryInputDto) {
    return { name: dto.name, word: dto.word, blurb: dto.blurb, image: dto.image };
  }
}
