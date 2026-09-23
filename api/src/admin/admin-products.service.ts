import { Injectable } from '@nestjs/common';
import { conflict, notFound, validationFailed, type FieldErrors } from '../common/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { PRODUCT_INCLUDE, toProductDto, type ProductDto } from '../catalog/product.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuditService } from './audit.service.js';
import type { AdminCtx } from './admin-custom.service.js';
import type { ProductInputDto } from './dto/product.dto.js';

/** "Rosie the Bear!" → "rosie-the-bear". */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 120);
}

/** Pure business checks shared by create and update. Returns field errors (empty = fine). */
export function checkProductInput(dto: ProductInputDto): FieldErrors {
  const fields: FieldErrors = {};
  if (dto.compareAtPrice != null && dto.compareAtPrice <= dto.price) fields.compareAtPrice = 'Must be higher than the price';
  const stock = dto.variants.reduce((s, v) => s + v.stock, 0);
  if (dto.isOneOfAKind && stock > 1) fields.variants = 'A one-of-a-kind piece can have at most 1 in stock';
  if (dto.status === 'PUBLISHED') {
    if (dto.variants.length === 0) fields.variants = 'Add at least one colour before publishing';
    if (dto.images.length === 0) fields.images = 'Add at least one photo before publishing';
  }
  const seen = new Set<string>();
  for (const [i, v] of dto.variants.entries()) {
    const key = `${v.colour.toLowerCase()}|${(v.size ?? '').toLowerCase()}`;
    if (seen.has(key)) fields[`variants.${i}.colour`] = 'Duplicate colour and size';
    seen.add(key);
  }
  return fields;
}

const nextSkuNumber = (skus: string[]) => skus.reduce((max, s) => Math.max(max, Number(/-(\d+)$/.exec(s)?.[1] ?? -1)), -1) + 1;
const skuFor = (slug: string, n: number) => `${slug}-${String(n).padStart(2, '0')}`;

/** Admin product CRUD. Images and variants are written together with the product in ONE transaction. */
@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(q?: string, status?: string): Promise<ProductDto[]> {
    const term = q?.trim();
    const batch = term && /^\d+$/.test(term) ? Number(term) : undefined;
    const rows = await this.prisma.product.findMany({
      where: {
        ...(status ? { status: status as 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' } : {}),
        ...(term ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, ...(batch != null && batch < 2_000_000_000 ? [{ batch }] : [])] } : {}),
      },
      include: PRODUCT_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { batch: 'desc' }],
      take: 500,
    });
    return rows.map(toProductDto);
  }

  async get(id: string): Promise<ProductDto> {
    const row = await this.prisma.product.findUnique({ where: { id }, include: PRODUCT_INCLUDE });
    if (!row) throw notFound('Product not found.');
    return toProductDto(row);
  }

  async create(ctx: AdminCtx, dto: ProductInputDto): Promise<ProductDto> {
    const fields = checkProductInput(dto);
    const slug = dto.slug ?? slugify(dto.name);
    if (!slug) fields.name = 'Use letters or numbers in the name';
    if (Object.keys(fields).length > 0) throw validationFailed(fields);

    return this.prisma.$transaction(async (tx) => {
      const category = await tx.category.findUnique({ where: { slug: dto.category }, select: { id: true } });
      if (!category) throw validationFailed({ category: 'Pick a category' });
      await this.assertSlugFree(tx, slug);
      // `batch` is a DB autoincrement: unique and gap-tolerant, never computed here.
      const created = await tx.product.create({
        data: {
          ...this.scalars(dto),
          slug,
          categoryId: category.id,
          sample: false,
          images: { create: dto.images.map((i, sortOrder) => ({ url: i.src, alt: i.alt, sortOrder })) },
          variants: { create: dto.variants.map((v, n) => ({ sku: skuFor(slug, n), colour: v.colour, size: v.size, priceDelta: v.priceDelta, stock: v.stock })) },
        },
        include: PRODUCT_INCLUDE,
      });
      await this.audit.log({ actorId: ctx.actorId, action: 'product.create', entity: 'Product', entityId: created.id, meta: { slug, batch: created.batch, status: dto.status }, ip: ctx.ip }, tx);
      return toProductDto(created);
    });
  }

  async update(ctx: AdminCtx, id: string, dto: ProductInputDto): Promise<ProductDto> {
    const fields = checkProductInput(dto);
    if (Object.keys(fields).length > 0) throw validationFailed(fields);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id }, include: { variants: true } });
      if (!existing) throw notFound('Product not found.');
      const category = await tx.category.findUnique({ where: { slug: dto.category }, select: { id: true } });
      if (!category) throw validationFailed({ category: 'Pick a category' });
      const slug = dto.slug ?? existing.slug;
      if (slug !== existing.slug) await this.assertSlugFree(tx, slug, id);

      await tx.product.update({ where: { id }, data: { ...this.scalars(dto), slug, categoryId: category.id, sample: false } });

      // Images: replaced wholesale, in the order given.
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (dto.images.length > 0) await tx.productImage.createMany({ data: dto.images.map((i, sortOrder) => ({ productId: id, url: i.src, alt: i.alt, sortOrder })) });

      // Variants: known ids update in place (so carts/orders keep pointing at them), the rest are created,
      // and existing variants that were dropped are deleted.
      const keep = new Set<string>();
      let sku = nextSkuNumber(existing.variants.map((v) => v.sku));
      const known = new Set(existing.variants.map((v) => v.id));
      for (const v of dto.variants) {
        if (v.id && known.has(v.id) && !keep.has(v.id)) {
          keep.add(v.id);
          await tx.productVariant.update({ where: { id: v.id }, data: { colour: v.colour, size: v.size ?? null, priceDelta: v.priceDelta, stock: v.stock } });
        } else {
          const created = await tx.productVariant.create({ data: { productId: id, sku: skuFor(existing.slug, sku++), colour: v.colour, size: v.size, priceDelta: v.priceDelta, stock: v.stock } });
          keep.add(created.id);
        }
      }
      await tx.productVariant.deleteMany({ where: { productId: id, id: { notIn: [...keep] } } });

      await this.audit.log({ actorId: ctx.actorId, action: 'product.update', entity: 'Product', entityId: id, meta: { slug, status: dto.status }, ip: ctx.ip }, tx);
      const fresh = await tx.product.findUniqueOrThrow({ where: { id }, include: PRODUCT_INCLUDE });
      return toProductDto(fresh);
    });
  }

  /** Bulk publish / draft / archive. Publishing needs a photo and a colour on every product. */
  async setStatus(ctx: AdminCtx, ids: string[], status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'): Promise<{ updated: number }> {
    const unique = [...new Set(ids)];
    return this.prisma.$transaction(async (tx) => {
      if (status === 'PUBLISHED') {
        const rows = await tx.product.findMany({ where: { id: { in: unique } }, select: { name: true, _count: { select: { images: true, variants: true } } } });
        const incomplete = rows.filter((r) => r._count.images === 0 || r._count.variants === 0).map((r) => r.name);
        if (incomplete.length > 0) throw conflict(`Add a photo and at least one colour before publishing: ${incomplete.join(', ')}.`);
      }
      const { count } = await tx.product.updateMany({ where: { id: { in: unique } }, data: { status } });
      await this.audit.log({ actorId: ctx.actorId, action: 'product.status', entity: 'Product', meta: { ids: unique, status, updated: count }, ip: ctx.ip }, tx);
      return { updated: count };
    });
  }

  /** "Delete" is an archive: orders keep their snapshots and the storefront stops listing it. */
  async archive(ctx: AdminCtx, id: string): Promise<ProductDto> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id }, select: { id: true } });
      if (!existing) throw notFound('Product not found.');
      const row = await tx.product.update({ where: { id }, data: { status: 'ARCHIVED' }, include: PRODUCT_INCLUDE });
      await this.audit.log({ actorId: ctx.actorId, action: 'product.archive', entity: 'Product', entityId: id, ip: ctx.ip }, tx);
      return toProductDto(row);
    });
  }

  private async assertSlugFree(tx: Prisma.TransactionClient, slug: string, exceptId?: string): Promise<void> {
    const taken = await tx.product.findUnique({ where: { slug }, select: { id: true } });
    if (taken && taken.id !== exceptId) throw conflict('Another product already uses that name/slug.', { name: 'Already used' });
  }

  private scalars(dto: ProductInputDto) {
    return {
      name: dto.name,
      tagline: dto.tagline,
      description: dto.description,
      price: dto.price,
      compareAtPrice: dto.compareAtPrice ?? null,
      fulfilment: dto.fulfilment,
      leadTimeDays: dto.leadTimeDays,
      fiber: dto.fiber,
      sizeCm: dto.sizeCm,
      weightG: dto.weightG,
      care: dto.care,
      swatches: dto.swatches.map((s) => ({ name: s.name, hex: s.hex })),
      isOneOfAKind: dto.isOneOfAKind,
      customizable: dto.customizable,
      giftable: dto.giftable,
      occasions: dto.occasions,
      tags: dto.tags,
      status: dto.status,
    };
  }
}
