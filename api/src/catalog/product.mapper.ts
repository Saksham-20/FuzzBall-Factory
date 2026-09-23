import type { Category, Prisma, Product, ProductImage, ProductVariant } from '../generated/prisma/client.js';

/** Wire shapes: web/src/lib/types.ts `Product`, `Category`. */
export interface ProductDto {
  id: string;
  slug: string;
  batch: number;
  name: string;
  tagline: string;
  description: string;
  /** Category slug. */
  category: string;
  price: number;
  compareAtPrice?: number;
  fulfilment: 'READY' | 'MADE_TO_ORDER';
  leadTimeDays: number;
  fiber: string;
  sizeCm: string;
  weightG: number;
  care: string[];
  images: { src: string; alt: string }[];
  swatches: { name: string; hex: string }[];
  variants: { id: string; colour: string; size?: string; priceDelta: number; stock: number }[];
  isOneOfAKind: boolean;
  customizable: boolean;
  giftable: boolean;
  occasions: string[];
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  sample?: boolean;
  rating?: { average: number; count: number };
  createdAt: string;
}

export interface CategoryDto {
  slug: string;
  name: string;
  word: string;
  blurb: string;
  image: string;
}

/** A product row loaded with everything the mapper needs (see `PRODUCT_INCLUDE`). */
export type ProductRow = Product & {
  category: Pick<Category, 'slug'>;
  images: ProductImage[];
  variants: ProductVariant[];
};

export const PRODUCT_INCLUDE = {
  category: { select: { slug: true } },
  images: { orderBy: { sortOrder: 'asc' } },
  variants: { orderBy: { sku: 'asc' } },
} satisfies Prisma.ProductInclude;

function toSwatches(json: unknown): { name: string; hex: string }[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((s) => {
    const o = s as { name?: unknown; hex?: unknown } | null;
    return o && typeof o.name === 'string' && typeof o.hex === 'string' ? [{ name: o.name, hex: o.hex }] : [];
  });
}

export const toProductDto = (p: ProductRow): ProductDto => ({
  id: p.id,
  slug: p.slug,
  batch: p.batch,
  name: p.name,
  tagline: p.tagline,
  description: p.description,
  category: p.category.slug,
  price: p.price,
  ...(p.compareAtPrice != null ? { compareAtPrice: p.compareAtPrice } : {}),
  fulfilment: p.fulfilment,
  leadTimeDays: p.leadTimeDays,
  fiber: p.fiber,
  sizeCm: p.sizeCm,
  weightG: p.weightG,
  care: p.care,
  images: p.images.map((i) => ({ src: i.url, alt: i.alt })),
  swatches: toSwatches(p.swatches),
  variants: p.variants.map((v) => ({ id: v.id, colour: v.colour, ...(v.size ? { size: v.size } : {}), priceDelta: v.priceDelta, stock: v.stock })),
  isOneOfAKind: p.isOneOfAKind,
  customizable: p.customizable,
  giftable: p.giftable,
  occasions: p.occasions,
  tags: p.tags,
  status: p.status,
  ...(p.sample ? { sample: true } : {}),
  ...(p.ratingCount > 0 ? { rating: { average: Math.round(p.ratingAverage * 10) / 10, count: p.ratingCount } } : {}),
  createdAt: p.createdAt.toISOString(),
});

export const toCategoryDto = (c: Category): CategoryDto => ({ slug: c.slug, name: c.name, word: c.word, blurb: c.blurb, image: c.image });
