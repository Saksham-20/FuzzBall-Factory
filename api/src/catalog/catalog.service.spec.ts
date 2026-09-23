import { sortProducts } from './catalog.service.js';
import { toProductDto, type ProductRow } from './product.mapper.js';

const p = (slug: string, over: Record<string, unknown> = {}, stocks: number[] = [3]) =>
  ({
    id: slug, slug, batch: 1, name: slug, tagline: '', description: '', categoryId: 'c', price: 500, compareAtPrice: null, fulfilment: 'READY', leadTimeDays: 2,
    fiber: '', sizeCm: '', weightG: 0, care: [], swatches: [{ name: 'Cream', hex: '#fff' }], isOneOfAKind: false, customizable: true, giftable: true, occasions: [], tags: [],
    status: 'PUBLISHED', sample: false, seoTitle: null, seoDescription: null, ratingAverage: 0, ratingCount: 0, createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date(),
    category: { slug: 'plushies' }, images: [{ id: 'i', productId: slug, url: '/a.jpg', alt: 'A', sortOrder: 0 }],
    variants: stocks.map((stock, i) => ({ id: `${slug}-${i}`, productId: slug, sku: `${slug}-0${i}`, colour: 'Cream', size: null, priceDelta: 0, stock })),
    ...over,
  }) as unknown as ProductRow;

const order = (rows: ProductRow[], sort?: Parameters<typeof sortProducts>[1]) => sortProducts(rows, sort).map((r) => r.slug);

describe('sortProducts', () => {
  const a = p('a', { price: 300, createdAt: new Date('2026-03-01') });
  const b = p('b', { price: 100, createdAt: new Date('2026-02-01'), fulfilment: 'MADE_TO_ORDER' });
  const c = p('c', { price: 200, createdAt: new Date('2026-04-01') });
  const soldOut = p('sold', { price: 50, createdAt: new Date('2026-05-01') }, [0, 0]);

  it('newest first by default', () => expect(order([a, b, c])).toEqual(['c', 'a', 'b']));
  it('price ascending / descending', () => {
    expect(order([a, b, c], 'price-asc')).toEqual(['b', 'c', 'a']);
    expect(order([a, b, c], 'price-desc')).toEqual(['a', 'c', 'b']);
  });
  it('ready-first groups ready before made-to-order, newest inside each', () => expect(order([b, a, c], 'ready-first')).toEqual(['c', 'a', 'b']));

  it('sold-out pieces are always last, whatever the sort', () => {
    for (const s of ['newest', 'price-asc', 'price-desc', 'ready-first'] as const) {
      expect(order([soldOut, a, b, c], s).at(-1)).toBe('sold');
    }
  });

  it('a product with any variant in stock is not sold out; all-zero is', () => {
    const partly = p('partly', { createdAt: new Date('2026-06-01') }, [0, 2]);
    expect(order([soldOut, partly, a])[0]).toBe('partly');
  });

  it('breaks exact ties by batch so pages are stable', () => {
    const t = new Date('2026-01-01');
    expect(order([p('x', { createdAt: t, batch: 1 }), p('y', { createdAt: t, batch: 2 })])).toEqual(['y', 'x']);
  });

  it('does not mutate its input', () => {
    const input = [a, b, c];
    sortProducts(input, 'price-asc');
    expect(input.map((r) => r.slug)).toEqual(['a', 'b', 'c']);
  });
});

describe('toProductDto (web Product shape)', () => {
  it('nests images/swatches/variants, maps the category to its slug, omits null/absent optionals', () => {
    const dto = toProductDto(p('rosie', { tags: ['bear'], sample: true, compareAtPrice: 700 }, [4]));
    expect(dto).toMatchObject({ id: 'rosie', category: 'plushies', compareAtPrice: 700, sample: true, images: [{ src: '/a.jpg', alt: 'A' }], swatches: [{ name: 'Cream', hex: '#fff' }], variants: [{ id: 'rosie-0', colour: 'Cream', priceDelta: 0, stock: 4 }], createdAt: '2026-01-01T00:00:00.000Z' });
    expect(dto.variants[0]).not.toHaveProperty('size');
    expect(dto).not.toHaveProperty('rating');
    expect(toProductDto(p('plain'))).not.toHaveProperty('compareAtPrice');
    expect(toProductDto(p('plain'))).not.toHaveProperty('sample');
  });

  it('exposes rating only when there are published reviews', () => {
    expect(toProductDto(p('r', { ratingAverage: 4.666, ratingCount: 3 })).rating).toEqual({ average: 4.7, count: 3 });
  });

  it('tolerates a malformed swatches column', () => {
    expect(toProductDto(p('bad', { swatches: 'nope' })).swatches).toEqual([]);
    expect(toProductDto(p('bad2', { swatches: [{ name: 1 }, { name: 'Ok', hex: '#000' }] })).swatches).toEqual([{ name: 'Ok', hex: '#000' }]);
  });

  it('never leaks internal columns', () => {
    expect(JSON.stringify(toProductDto(p('x')))).not.toMatch(/sku|seoTitle|updatedAt|ratingAverage|categoryId/);
  });
});
