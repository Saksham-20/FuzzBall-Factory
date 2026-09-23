import { AdminProductsService, checkProductInput, slugify } from './admin-products.service.js';
import type { ProductInputDto } from './dto/product.dto.js';

const input = (over: Partial<ProductInputDto> = {}): ProductInputDto =>
  ({
    name: 'Rosie the Bear',
    tagline: 'Softest hugs',
    description: 'A bear.',
    category: 'plushies',
    price: 1450,
    fulfilment: 'MADE_TO_ORDER',
    leadTimeDays: 7,
    fiber: 'Milk cotton',
    sizeCm: '20 cm',
    weightG: 120,
    care: [],
    images: [{ src: '/uploads/a.jpg', alt: 'Rosie' }, { src: '/uploads/b.jpg', alt: '' }],
    swatches: [{ name: 'Cherry', hex: '#c0392b' }],
    variants: [{ colour: 'Cherry', priceDelta: 0, stock: 0 }, { colour: 'Cream', priceDelta: 50, stock: 0 }],
    isOneOfAKind: false,
    customizable: true,
    giftable: true,
    occasions: [],
    tags: [],
    status: 'DRAFT',
    ...over,
  }) as ProductInputDto;

describe('slugify', () => {
  it.each([
    ['Rosie the Bear', 'rosie-the-bear'],
    ['  Coaster Set (4)!  ', 'coaster-set-4'],
    ['Crème brûlée Charm', 'creme-brulee-charm'],
    ['---', ''],
  ])('%s -> %s', (name, slug) => expect(slugify(name)).toBe(slug));
});

describe('checkProductInput', () => {
  it('accepts a normal draft and a normal published product', () => {
    expect(checkProductInput(input())).toEqual({});
    expect(checkProductInput(input({ status: 'PUBLISHED' }))).toEqual({});
  });

  it('compare-at must be higher than the price', () => {
    expect(checkProductInput(input({ compareAtPrice: 1450 }))).toHaveProperty('compareAtPrice');
    expect(checkProductInput(input({ compareAtPrice: 1800 }))).toEqual({});
  });

  it('cannot publish without a photo or a colour', () => {
    expect(checkProductInput(input({ status: 'PUBLISHED', images: [] }))).toHaveProperty('images');
    expect(checkProductInput(input({ status: 'PUBLISHED', variants: [] }))).toHaveProperty('variants');
    expect(checkProductInput(input({ status: 'DRAFT', images: [], variants: [] }))).toEqual({});
  });

  it('one-of-a-kind means at most one in stock, and duplicate colour/size pairs are refused', () => {
    expect(checkProductInput(input({ isOneOfAKind: true, variants: [{ colour: 'Grey', priceDelta: 0, stock: 2 }] }))).toHaveProperty('variants');
    expect(checkProductInput(input({ isOneOfAKind: true, variants: [{ colour: 'Grey', priceDelta: 0, stock: 1 }] }))).toEqual({});
    const dup = checkProductInput(input({ variants: [{ colour: 'Cream', size: 'M', priceDelta: 0, stock: 1 }, { colour: 'cream', size: 'm', priceDelta: 0, stock: 1 }] }));
    expect(dup).toHaveProperty(['variants.1.colour']);
  });
});

/**
 * A stand-in for PrismaService whose ROOT client has no model delegates at all: the only way for the service to
 * read or write is through the transaction handle it is given, so anything that escaped the transaction throws.
 */
function harness(existing?: { id: string; slug: string; variants: { id: string; sku: string }[] }) {
  const calls: string[] = [];
  const rec = (name: string, result: unknown = {}) => async (...args: unknown[]) => {
    calls.push(name);
    void args;
    return result;
  };
  const productRow = { id: 'p1', batch: 16, slug: 'rosie-the-bear', name: 'Rosie the Bear', tagline: '', description: '', category: { slug: 'plushies' }, price: 1450, compareAtPrice: null, fulfilment: 'MADE_TO_ORDER', leadTimeDays: 7, fiber: '', sizeCm: '', weightG: 0, care: [], images: [], swatches: [], variants: [], isOneOfAKind: false, customizable: true, giftable: true, occasions: [], tags: [], status: 'DRAFT', sample: false, ratingAverage: 0, ratingCount: 0, createdAt: new Date() };
  const tx = {
    category: { findUnique: rec('category.findUnique', { id: 'c1' }) },
    product: {
      findUnique: async (args: { where: { slug?: string; id?: string } }) => {
        calls.push('product.findUnique');
        if (args.where.id) return existing ? { ...existing } : null;
        return null; // slug free
      },
      findUniqueOrThrow: rec('product.findUniqueOrThrow', productRow),
      create: rec('product.create', productRow),
      update: rec('product.update', productRow),
    },
    productImage: { deleteMany: rec('productImage.deleteMany'), createMany: rec('productImage.createMany') },
    productVariant: { create: rec('productVariant.create', { id: 'vNew' }), update: rec('productVariant.update'), deleteMany: rec('productVariant.deleteMany') },
    auditLog: { create: rec('auditLog.create') },
  };
  let transactions = 0;
  const prisma = {
    $transaction: async <T>(fn: (t: typeof tx) => Promise<T>): Promise<T> => {
      transactions += 1;
      return fn(tx);
    },
  };
  const audit = { log: async (entry: unknown, db: unknown) => { calls.push(db === tx ? 'audit(tx)' : 'audit(ROOT)'); void entry; } };
  const svc = new AdminProductsService(prisma as never, audit as never);
  return { svc, calls, tx, transactions: () => transactions };
}

describe('AdminProductsService transactions', () => {
  const ctx = { actorId: 'admin1' };

  it('create writes product + images + variants in ONE transaction and audits through the same handle', async () => {
    const h = harness();
    await h.svc.create(ctx, input());
    expect(h.transactions()).toBe(1);
    expect(h.calls).toContain('product.create');
    expect(h.calls.at(-1)).toBe('audit(tx)');
  });

  it('a slug clash is a 409 and nothing is written', async () => {
    const h = harness();
    h.tx.product.findUnique = (async () => ({ id: 'other' })) as never;
    await expect(h.svc.create(ctx, input())).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(h.calls).not.toContain('product.create');
  });

  it('update replaces images, updates known variants in place, creates new ones and deletes dropped ones', async () => {
    const h = harness({ id: 'p1', slug: 'rosie-the-bear', variants: [{ id: 'v1', sku: 'rosie-the-bear-00' }, { id: 'v2', sku: 'rosie-the-bear-01' }] });
    await h.svc.update(ctx, 'p1', input({ variants: [{ id: 'v1', colour: 'Cherry', priceDelta: 0, stock: 3 }, { colour: 'Mint', priceDelta: 0, stock: 1 }] }));
    expect(h.transactions()).toBe(1);
    expect(h.calls.filter((c) => c === 'productVariant.update')).toHaveLength(1);
    expect(h.calls.filter((c) => c === 'productVariant.create')).toHaveLength(1);
    expect(h.calls).toContain('productVariant.deleteMany'); // v2 was dropped
    expect(h.calls.indexOf('productImage.deleteMany')).toBeLessThan(h.calls.indexOf('productImage.createMany'));
    expect(h.calls.at(-2)).toBe('audit(tx)');
  });

  it('a failure part-way through rejects the whole call (Prisma rolls the transaction back)', async () => {
    const h = harness({ id: 'p1', slug: 'rosie-the-bear', variants: [] });
    h.tx.productVariant.create = (async () => {
      throw new Error('boom');
    }) as never;
    await expect(h.svc.update(ctx, 'p1', input())).rejects.toThrow('boom');
    expect(h.calls).not.toContain('audit(tx)'); // no audit row for a change that never committed
  });

  it('unknown product is a 404', async () => {
    const h = harness();
    await expect(h.svc.update(ctx, 'nope', input())).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
