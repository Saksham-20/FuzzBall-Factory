import { bootCommerce, cleanupCommerce, guest, makeProduct, MOCK_PAYMENT_ENV, type CommerceApp } from './helpers/commerce.js';

/** Public read endpoints against the real DB: catalogue, settings, shipping, coupon validation. Read-only apart from its own `cat<stamp>` rows. */
const TAG = `cat${Date.now()}`;
const KEY = `zq${Date.now().toString(36)}`; // unique search word so seeded/other tests' products never interfere

describe('catalogue, settings, shipping (e2e)', () => {
  let t: CommerceApp;
  const http = () => guest(t);
  let a: Awaited<ReturnType<typeof makeProduct>>;
  let b: typeof a;
  let c: typeof a;
  let d: typeof a;
  let draft: typeof a;
  let archived: typeof a;
  let other: typeof a;

  const list = async (qs: string) => (await http().get(`/products?q=${KEY}${qs}`).expect(200)).body as { items: { id: string; slug: string }[]; total: number; page: number; pageSize: number };
  const slugs = (r: { items: { slug: string }[] }) => r.items.map((i) => i.slug);

  beforeAll(async () => {
    t = await bootCommerce({ env: MOCK_PAYMENT_ENV });
    const now = Date.now();
    const base = (extra: Record<string, unknown>) => ({ extra: { tags: [KEY], ...extra } });
    a = await makeProduct(t.prisma, TAG, { price: 300, categorySlug: 'plushies', ...base({ occasions: ['Birthday'], createdAt: new Date(now - 1000), tagline: 'A soft ONE' }) });
    b = await makeProduct(t.prisma, TAG, { price: 100, fulfilment: 'MADE_TO_ORDER', categorySlug: 'plushies', ...base({ occasions: ['Anniversary'], createdAt: new Date(now - 2000), swatches: [{ name: 'Dusty rose', hex: '#c98586' }] }) });
    c = await makeProduct(t.prisma, TAG, { price: 200, stock: 0, categorySlug: 'plushies', ...base({ createdAt: new Date(now - 500) }) });
    d = await makeProduct(t.prisma, TAG, { price: 500, categorySlug: 'keychains', ...base({ createdAt: new Date(now - 3000) }) });
    draft = await makeProduct(t.prisma, TAG, { status: 'DRAFT', ...base({}) });
    archived = await makeProduct(t.prisma, TAG, { status: 'ARCHIVED', ...base({}) });
    other = await makeProduct(t.prisma, TAG, { categorySlug: 'plushies' }); // no KEY tag
  });

  afterAll(async () => {
    await t.prisma.setting.deleteMany({ where: { key: 'e2e_internal_secret' } });
    await cleanupCommerce(t.prisma, { tags: [TAG] });
    t.restoreEnv();
    await t.app.close();
  });

  it('GET /categories returns the web Category shape in display order', async () => {
    const res = await http().get('/categories').expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(8);
    expect(Object.keys(res.body[0]).sort()).toEqual(['blurb', 'image', 'name', 'slug', 'word']);
    expect(res.body[0].slug).toBe('plushies');
  });

  describe('GET /products', () => {
    it('returns {items,total,page,pageSize}; published only; newest first with sold-out last', async () => {
      const r = await list('');
      expect(r).toMatchObject({ total: 4, page: 1, pageSize: 12 });
      expect(slugs(r)).toEqual([a.slug, b.slug, d.slug, c.slug]); // c is sold out (newest of the lot) so it drops to the end
      expect(slugs(r)).not.toContain(draft.slug);
      expect(slugs(r)).not.toContain(archived.slug);
    });

    it('item shape is the web Product', async () => {
      const [item] = (await http().get(`/products?q=${KEY}&sort=price-asc`).expect(200)).body.items;
      expect(item).toMatchObject({
        slug: b.slug, category: 'plushies', price: 100, fulfilment: 'MADE_TO_ORDER', status: 'PUBLISHED', sample: true,
        images: [{ src: '/samples/bear.jpg', alt: 'Bear' }], swatches: [{ name: 'Dusty rose', hex: '#c98586' }],
        variants: [{ id: b.variantId, colour: 'Cream', priceDelta: 0, stock: 5 }],
      });
      expect(typeof item.batch).toBe('number');
      expect(new Date(item.createdAt).toISOString()).toBe(item.createdAt);
      for (const k of ['id', 'tagline', 'description', 'leadTimeDays', 'fiber', 'sizeCm', 'weightG', 'care', 'isOneOfAKind', 'customizable', 'giftable', 'occasions', 'tags']) expect(item).toHaveProperty(k);
      expect(item).not.toHaveProperty('rating'); // no reviews yet
    });

    it('sorts by price and ready-first, keeping sold-out last every time', async () => {
      expect(slugs(await list('&sort=price-asc'))).toEqual([b.slug, a.slug, d.slug, c.slug]);
      expect(slugs(await list('&sort=price-desc'))).toEqual([d.slug, a.slug, b.slug, c.slug]);
      expect(slugs(await list('&sort=ready-first'))).toEqual([a.slug, d.slug, b.slug, c.slug]);
    });

    it('filters: category, price range, availability, colour, occasion', async () => {
      expect(slugs(await list('&category=keychains'))).toEqual([d.slug]);
      expect(slugs(await list('&min=150&max=350&sort=price-asc'))).toEqual([a.slug, c.slug].sort((x, y) => (x === a.slug ? -1 : y === a.slug ? 1 : 0)));
      expect(slugs(await list('&availability=mto'))).toEqual([b.slug]);
      expect(slugs(await list('&availability=ready&sort=price-asc'))).toEqual([a.slug, d.slug, c.slug]);
      expect(slugs(await list('&colour=DUSTY%20ROSE'))).toEqual([b.slug]);
      expect(slugs(await list('&occasion=Anniversary'))).toEqual([b.slug]);
      expect((await list('&occasion=Nothing')).total).toBe(0);
    });

    it('free-text search is case-insensitive over name, tagline, description and tags', async () => {
      const byTagline = await http().get(`/products?q=SOFT%20one`).expect(200);
      expect(slugs(byTagline.body)).toContain(a.slug);
      expect(slugs(await list(''))).not.toContain(other.slug);
    });

    it('paginates', async () => {
      const p1 = await list('&pageSize=3&page=1');
      const p2 = await list('&pageSize=3&page=2');
      expect(p1).toMatchObject({ total: 4, page: 1, pageSize: 3 });
      expect(slugs(p1)).toHaveLength(3);
      expect(slugs(p2)).toEqual([c.slug]);
      expect((await list('&pageSize=3&page=9')).items).toEqual([]);
    });

    it('validates its query (400 with the standard error shape)', async () => {
      for (const qs of ['sort=bogus', 'pageSize=1000', 'pageSize=0', 'page=0', 'min=-1', 'min=abc', 'availability=maybe']) {
        const r = await http().get(`/products?${qs}`).expect(400);
        expect(r.body.code).toBe('VALIDATION_FAILED');
      }
    });
  });

  describe('single product, related, by-ids', () => {
    it('GET /products/:slug returns published products and 404s for draft, archived and unknown', async () => {
      const ok = await http().get(`/products/${a.slug}`).expect(200);
      expect(ok.body).toMatchObject({ id: a.productId, slug: a.slug });
      for (const s of [draft.slug, archived.slug, 'no-such-product']) {
        const r = await http().get(`/products/${s}`).expect(404);
        expect(r.body).toEqual({ code: 'NOT_FOUND', message: "We couldn't find that piece." });
      }
    });

    it('related: same category first, never itself, honours the limit', async () => {
      const r = (await http().get(`/products/${a.slug}/related?limit=4`).expect(200)).body as { slug: string; category: string }[];
      expect(r).toHaveLength(4);
      expect(r.map((x) => x.slug)).not.toContain(a.slug);
      const firstOther = r.findIndex((x) => x.category !== 'plushies');
      const lastSame = r.map((x) => x.category).lastIndexOf('plushies');
      if (firstOther !== -1) expect(lastSame).toBeLessThan(firstOther);
      expect((await http().get(`/products/${a.slug}/related?limit=1`).expect(200)).body).toHaveLength(1);
      await http().get('/products/no-such/related').expect(404);
      await http().get(`/products/${a.slug}/related?limit=99`).expect(400);
    });

    it('by-ids returns published and archived pieces (for baskets) but never drafts or unknown ids', async () => {
      const r = (await http().get(`/products/by-ids?ids=${a.productId},${archived.productId},${draft.productId},nope`).expect(200)).body as { id: string; status: string }[];
      expect(r.map((x) => x.id).sort()).toEqual([a.productId, archived.productId].sort());
      expect(r.find((x) => x.id === archived.productId)?.status).toBe('ARCHIVED');
      expect((await http().get('/products/by-ids?ids=').expect(200)).body).toEqual([]);
      expect((await http().get('/products/by-ids').expect(400)).body.code).toBe('VALIDATION_FAILED'); // the ids param is required
      expect((await http().get(`/products/by-ids?ids=${Array.from({ length: 60 }, (_, i) => `id${i}`).join(',')}`).expect(400)).body.code).toBe('BAD_REQUEST');
    });
  });

  it('GET /settings returns exactly the public StoreSettings keys', async () => {
    await t.prisma.setting.upsert({ where: { key: 'e2e_internal_secret' }, update: {}, create: { key: 'e2e_internal_secret', value: 'do-not-leak' } });
    const res = await http().get('/settings').expect(200);
    expect(Object.keys(res.body).sort()).toEqual(['codCap', 'codEnabled', 'codFee', 'depositPct', 'domesticShipping', 'email', 'freeShippingAbove', 'giftWrapPrice', 'intlZones', 'quoteValidityDays', 'whatsapp']);
    expect(JSON.stringify(res.body)).not.toContain('do-not-leak');
    expect(res.body.intlZones[0]).toEqual({ name: expect.any(String), countries: expect.any(Array), rate: expect.any(Number), days: expect.any(String) });
  });

  describe('GET /shipping/check', () => {
    it('validates Indian pincodes', async () => {
      const bad = await http().get('/shipping/check?country=IN&postalCode=12').expect(200);
      expect(bad.body).toEqual({ serviceable: false, message: 'Enter a valid 6-digit pincode.', transitDays: '', codAvailable: false });
      const ok = await http().get('/shipping/check?country=IN&postalCode=560038&leadTimeDays=5&ready=true').expect(200);
      expect(ok.body).toMatchObject({ serviceable: true, transitDays: '3–6 days', codAvailable: true });
      expect(new Date(ok.body.deliverBy).getTime()).toBeGreaterThan(Date.now() + 5 * 86_400_000);
    });

    it('international uses the zone table; garbage input is a 400', async () => {
      const gb = await http().get('/shipping/check?country=gb&postalCode=N10%202LE').expect(200);
      expect(gb.body).toMatchObject({ serviceable: true, transitDays: '8–14 days', codAvailable: false });
      await http().get('/shipping/check').expect(400);
      await http().get('/shipping/check?country=India').expect(400);
      await http().get('/shipping/check?country=IN&ready=maybe').expect(400);
    });
  });

  describe('POST /coupons/validate', () => {
    it('validates against the server-priced basket', async () => {
      const lines = [{ productId: a.productId, variantId: a.variantId, qty: 1 }];
      const ok = await http().post('/coupons/validate').send({ code: 'firstfuzz', lines }).expect(200);
      expect(ok.body).toEqual({ valid: true, code: 'FIRSTFUZZ', kind: 'PERCENT', value: 10, discount: 30 });
      expect((await http().post('/coupons/validate').send({ code: 'GIFT100', lines }).expect(200)).body).toEqual({ valid: false, error: 'Add ₹699 more to use this code.' });
      expect((await http().post('/coupons/validate').send({ code: 'EXPIRED20', lines }).expect(200)).body).toEqual({ valid: false, error: "This code isn't active." });
      expect((await http().post('/coupons/validate').send({ code: 'NOPE', lines }).expect(200)).body.valid).toBe(false);
    });
  });
});
