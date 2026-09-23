import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { badRequest, notFound } from '../common/errors.js';
import type { Paginated } from '../common/dto/pagination.dto.js';
import { PRODUCT_INCLUDE, toCategoryDto, toProductDto, type CategoryDto, type ProductDto, type ProductRow } from './product.mapper.js';
import type { ProductQueryDto, ProductSort } from './dto/product-query.dto.js';

const MAX_BY_IDS = 50;

export const isSoldOut = (p: Pick<ProductRow, 'variants'>) => p.variants.every((v) => v.stock === 0);

/**
 * Same ordering as web `catalog.listProducts`: sold-out pieces always last, then the chosen sort
 * (newest as the tie-breaker; `batch` breaks exact timestamp ties so pages are stable).
 */
export function sortProducts<T extends Pick<ProductRow, 'variants' | 'price' | 'fulfilment' | 'createdAt' | 'batch'>>(items: T[], sort: ProductSort = 'newest'): T[] {
  const byNew = (a: T, b: T) => b.createdAt.getTime() - a.createdAt.getTime() || b.batch - a.batch;
  return [...items].sort((a, b) => {
    if (isSoldOut(a) !== isSoldOut(b)) return isSoldOut(a) ? 1 : -1;
    if (sort === 'price-asc') return a.price - b.price || byNew(a, b);
    if (sort === 'price-desc') return b.price - a.price || byNew(a, b);
    if (sort === 'ready-first') return a.fulfilment === b.fulfilment ? byNew(a, b) : a.fulfilment === 'READY' ? -1 : 1;
    return byNew(a, b);
  });
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories(): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
    return rows.map(toCategoryDto);
  }

  /**
   * Filters that map cleanly to SQL run in the database; the free-text, colour-swatch (JSON) and sold-out
   * rules run on the result set in memory, so the response matches the web mock exactly. A boutique
   * catalogue is hundreds of rows, not millions; revisit if that stops being true.
   */
  async listProducts(query: ProductQueryDto): Promise<Paginated<ProductDto>> {
    const { category, q, sort = 'newest', min, max, availability, colour, occasion, page, pageSize } = query;
    const where: Prisma.ProductWhereInput = {
      status: 'PUBLISHED',
      ...(category ? { category: { slug: category } } : {}),
      ...(min != null || max != null ? { price: { ...(min != null ? { gte: min } : {}), ...(max != null ? { lte: max } : {}) } } : {}),
      ...(availability ? { fulfilment: availability === 'ready' ? 'READY' : 'MADE_TO_ORDER' } : {}),
      ...(occasion ? { occasions: { has: occasion } } : {}),
    };
    let rows: ProductRow[] = await this.prisma.product.findMany({ where, include: PRODUCT_INCLUDE });

    if (q) {
      const s = q.toLowerCase();
      rows = rows.filter((p) => [p.name, p.tagline, p.description, ...p.tags].join(' ').toLowerCase().includes(s));
    }
    if (colour) {
      const c = colour.toLowerCase();
      rows = rows.filter((p) => toProductDto(p).swatches.some((s) => s.name.toLowerCase() === c));
    }

    const sorted = sortProducts(rows, sort);
    return {
      items: sorted.slice((page - 1) * pageSize, page * pageSize).map(toProductDto),
      total: sorted.length,
      page,
      pageSize,
    };
  }

  async getProduct(slug: string): Promise<ProductDto> {
    const p = await this.prisma.product.findFirst({ where: { slug, status: 'PUBLISHED' }, include: PRODUCT_INCLUDE });
    if (!p) throw notFound("We couldn't find that piece.");
    return toProductDto(p);
  }

  /** Same category first, then the rest; newest first inside each group. Excludes the piece itself. */
  async related(slug: string, limit: number): Promise<ProductDto[]> {
    const current = await this.prisma.product.findFirst({ where: { slug, status: 'PUBLISHED' }, select: { categoryId: true } });
    if (!current) throw notFound("We couldn't find that piece.");
    const all = await this.prisma.product.findMany({
      where: { status: 'PUBLISHED', slug: { not: slug } },
      include: PRODUCT_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { batch: 'desc' }],
    });
    const same = all.filter((p) => p.categoryId === current.categoryId);
    const rest = all.filter((p) => p.categoryId !== current.categoryId);
    return [...same, ...rest].slice(0, limit).map(toProductDto);
  }

  /**
   * Products for the lines in a basket, by id. Published and archived pieces (an archived one that was
   * in someone's basket can still be shown and removed). DRAFT products are never returned.
   */
  async byIds(idsParam: string): Promise<ProductDto[]> {
    const ids = [...new Set(idsParam.split(',').map((s) => s.trim()).filter(Boolean))];
    if (ids.length > MAX_BY_IDS) throw badRequest(`Ask for at most ${MAX_BY_IDS} products at a time.`);
    if (ids.length === 0) return [];
    const rows = await this.prisma.product.findMany({ where: { id: { in: ids }, status: { in: ['PUBLISHED', 'ARCHIVED'] } }, include: PRODUCT_INCLUDE });
    return rows.map(toProductDto);
  }
}
