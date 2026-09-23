import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootApp, makeUser, type TestApp, type TestUser } from './helpers/e2e.js';

/** Admin CRUD, dashboard maths, order status delegation, moderation, settings. Real DB; removes what it creates. */
describe('admin API (e2e)', () => {
  let t: TestApp;
  let app: INestApplication;
  let admin: TestUser;
  let customer: TestUser;
  const stamp = Date.now();
  const orderPrefix = `E2E${stamp}`;
  const productIds: string[] = [];
  let categorySlug: string;
  let originalSettings: Record<string, unknown>;

  const productBody = (over: Record<string, unknown> = {}) => ({
    name: `E2E Bear ${stamp}`,
    tagline: 'Softest hugs',
    description: 'A test bear.',
    category: categorySlug,
    price: 1450,
    fulfilment: 'READY',
    leadTimeDays: 2,
    fiber: 'Milk cotton',
    sizeCm: '20 cm',
    weightG: 120,
    care: ['Hand wash'],
    images: [{ src: '/uploads/e2e-1.jpg', alt: 'front' }, { src: '/uploads/e2e-2.jpg', alt: 'back' }],
    swatches: [{ name: 'Cherry', hex: '#c0392b' }],
    variants: [{ colour: 'Cherry', priceDelta: 0, stock: 5 }, { colour: 'Cream', priceDelta: 50, stock: 5 }],
    isOneOfAKind: false,
    customizable: true,
    giftable: true,
    occasions: ['Birthday'],
    tags: ['bear'],
    status: 'DRAFT',
    ...over,
  });

  async function makeOrder(n: number, over: Record<string, unknown> = {}) {
    return t.prisma.order.create({
      data: {
        number: `${orderPrefix}-${n}`,
        contact: { name: 'E2E Buyer', email: 'buyer@example.com', phone: '+919800000009' },
        contactEmail: 'buyer@example.com',
        contactPhone: '+919800000009',
        address: { name: 'E2E Buyer', phone: '+919800000009', line1: '1 Test Road', city: 'Pune', state: 'Maharashtra', postalCode: '411001', country: 'IN' },
        subtotal: 1000, shipping: 0, total: 1000, paymentMethod: 'RAZORPAY', paymentStatus: 'PAID', status: 'CONFIRMED',
        estimatedDispatch: new Date(Date.now() + 2 * 86_400_000),
        items: { create: [{ name: 'E2E Bear', image: '/x.jpg', colour: 'Cherry', qty: 1, unitPrice: 1000, fulfilment: 'MADE_TO_ORDER' }] },
        events: { create: [{ status: 'PLACED' }] },
        ...over,
      },
    });
  }

  beforeAll(async () => {
    t = await bootApp();
    app = t.app;
    categorySlug = (await t.prisma.category.findFirstOrThrow()).slug;
    [admin, customer] = [await makeUser(t, 'admin', 'admin'), await makeUser(t, 'customer', 'cust')];
    originalSettings = (await admin.agent.get('/admin/settings').expect(200)).body;
  });

  afterAll(async () => {
    await admin.agent.put('/admin/settings').send(originalSettings);
    await t.prisma.customRequest.deleteMany({ where: { number: { startsWith: orderPrefix } } });
    await t.prisma.order.deleteMany({ where: { number: { startsWith: orderPrefix } } });
    await t.prisma.review.deleteMany({ where: { author: `E2E ${stamp}` } });
    await t.prisma.product.deleteMany({ where: { OR: [{ id: { in: productIds } }, { name: { startsWith: 'E2E ' }, slug: { contains: String(stamp) } }] } });
    await t.prisma.category.deleteMany({ where: { slug: { startsWith: `e2e-cat-${stamp}` } } });
    await t.prisma.coupon.deleteMany({ where: { code: { startsWith: `E2E${stamp}` } } });
    await t.prisma.material.deleteMany({ where: { name: { startsWith: `E2E Material ${stamp}` } } });
    await t.prisma.auditLog.deleteMany({ where: { actorId: admin.id } });
    await t.prisma.user.deleteMany({ where: { id: { in: [admin.id, customer.id] } } });
    await app.close();
  });

  describe('dashboard', () => {
    it('counts and sums real rows: paid orders add to revenue, unpaid and pending ones do not', async () => {
      const before = (await admin.agent.get('/admin/dashboard').expect(200)).body;
      await makeOrder(1, { total: 1234, subtotal: 1234, paymentStatus: 'PAID', status: 'CONFIRMED' });
      await makeOrder(2, { total: 500, subtotal: 500, paymentStatus: 'PENDING', status: 'PENDING_PAYMENT' }); // abandoned checkout
      await makeOrder(3, { total: 799, subtotal: 799, paymentMethod: 'COD', paymentStatus: 'COD_DUE', status: 'PLACED' });
      const after = (await admin.agent.get('/admin/dashboard').expect(200)).body;

      expect(after.revenue.today - before.revenue.today).toBe(1234);
      expect(after.revenue.d7 - before.revenue.d7).toBe(1234);
      expect(after.revenue.d30 - before.revenue.d30).toBe(1234);
      expect(after.ordersToday - before.ordersToday).toBe(2); // pending-payment attempt is not an order
      expect(after.pendingCod - before.pendingCod).toBe(1);
      expect(after.revenueByDay).toHaveLength(30);
      expect(after.revenueByDay.reduce((s: number, d: { amount: number }) => s + d.amount, 0)).toBe(after.revenue.d30);
      expect(after.revenueByDay.at(-1).amount).toBe(after.revenue.today);
      expect(after.needsYou).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'cod', href: `/admin/orders/${orderPrefix}-3` }), expect.objectContaining({ kind: 'pack', href: `/admin/orders/${orderPrefix}-1` })]));
      const ats: string[] = after.needsYou.map((n: { at: string }) => n.at);
      expect(ats).toEqual(ats.toSorted());
    });

    it('lists low-stock ready-to-ship products (and only published ones)', async () => {
      const low = (await admin.agent.post('/admin/products').send(productBody({ name: `E2E Low ${stamp}`, status: 'PUBLISHED', variants: [{ colour: 'Grey', priceDelta: 0, stock: 1 }] })).expect(201)).body;
      const hidden = (await admin.agent.post('/admin/products').send(productBody({ name: `E2E Draft ${stamp}`, status: 'DRAFT', variants: [{ colour: 'Grey', priceDelta: 0, stock: 0 }] })).expect(201)).body;
      productIds.push(low.id, hidden.id);
      const dash = (await admin.agent.get('/admin/dashboard').expect(200)).body;
      const ids = dash.lowStock.map((p: { id: string }) => p.id);
      expect(ids).toContain(low.id);
      expect(ids).not.toContain(hidden.id);
      expect(dash.lowStock.find((p: { id: string }) => p.id === low.id).variants[0].stock).toBe(1);
    });

    it('counts work orders by stage', async () => {
      const dash = (await admin.agent.get('/admin/dashboard').expect(200)).body;
      const [toQuote, awaiting, inProgress] = await Promise.all([
        t.prisma.customRequest.count({ where: { status: { in: ['REQUESTED', 'UNDER_REVIEW', 'COUNTERED'] } } }),
        t.prisma.customRequest.count({ where: { status: 'QUOTED' } }),
        t.prisma.customRequest.count({ where: { status: 'IN_PROGRESS' } }),
      ]);
      expect(dash).toMatchObject({ toQuote, awaitingCustomer: awaiting, inProgress });
    });

    it('workshop load counts orders in production/packing plus custom work orders in progress, and ages the oldest one', async () => {
      const before = (await admin.agent.get('/admin/dashboard').expect(200)).body;
      const oldStart = new Date(Date.now() - 9 * 86_400_000);

      await makeOrder(4, {
        status: 'IN_PRODUCTION',
        events: { create: [{ status: 'PLACED', at: oldStart }, { status: 'CONFIRMED', at: oldStart }, { status: 'IN_PRODUCTION', at: oldStart }] },
      });
      await makeOrder(5, { status: 'PACKED', events: { create: [{ status: 'PLACED' }, { status: 'PACKED' }] } });
      await t.prisma.customRequest.create({
        data: {
          number: `${orderPrefix}-WO-1`,
          userId: customer.id,
          customerName: 'E2E Buyer',
          customerPhone: '+919800000009',
          category: categorySlug,
          title: 'E2E work order',
          description: 'A test work order.',
          colours: ['Cream'],
          budgetMin: 1000,
          budgetMax: 1500,
          status: 'IN_PROGRESS',
          events: { create: [{ status: 'IN_PROGRESS', at: oldStart }] },
        },
      });

      const after = (await admin.agent.get('/admin/dashboard').expect(200)).body;
      expect(after.workshopLoad.ordersInProduction - before.workshopLoad.ordersInProduction).toBe(2);
      expect(after.workshopLoad.customInProgress - before.workshopLoad.customInProgress).toBe(1);
      expect(after.workshopLoad.oldestDays).toBeGreaterThanOrEqual(9);
      expect(after.workshopLoad.summary).toMatch(/^\d+ pieces? in progress, oldest started \d+ days? ago\.$/);

      // Clean up now, not just in afterAll: this custom request is linked to `customer` and would otherwise
      // throw off that user's work-order count in later tests in this file.
      await t.prisma.customRequest.deleteMany({ where: { number: `${orderPrefix}-WO-1` } });
      await t.prisma.order.deleteMany({ where: { number: { in: [`${orderPrefix}-4`, `${orderPrefix}-5`] } } });
    });
  });

  describe('products', () => {
    it('creates with images + variants in one go, gets a unique batch, and slugs from the name', async () => {
      const a = (await admin.agent.post('/admin/products').send(productBody({ name: `E2E Rosie ${stamp}` })).expect(201)).body;
      const b = (await admin.agent.post('/admin/products').send(productBody({ name: `E2E Penguin ${stamp}` })).expect(201)).body;
      productIds.push(a.id, b.id);
      expect(a.slug).toBe(`e2e-rosie-${stamp}`);
      expect(a.batch).toBeGreaterThan(0);
      expect(b.batch).toBeGreaterThan(a.batch);
      expect(a.images).toEqual([{ src: '/uploads/e2e-1.jpg', alt: 'front' }, { src: '/uploads/e2e-2.jpg', alt: 'back' }]);
      expect(a.variants.map((v: { colour: string; stock: number }) => [v.colour, v.stock])).toEqual([['Cherry', 5], ['Cream', 5]]);
      expect(a).toMatchObject({ category: categorySlug, status: 'DRAFT' });
      expect(a).not.toHaveProperty('sample');
      expect((await admin.agent.get(`/admin/products/${a.id}`).expect(200)).body).toEqual(a);
      await admin.agent.get('/admin/products/nope').expect(404);
    });

    it('slug clash → 409 with a field error; bad input → 400 per field; unknown category → 400', async () => {
      const clash = await admin.agent.post('/admin/products').send(productBody({ name: `E2E Rosie ${stamp}` })).expect(409);
      expect(clash.body).toMatchObject({ code: 'CONFLICT', fields: { name: 'Already used' } });
      const bad = await admin.agent.post('/admin/products').send(productBody({ price: 0, compareAtPrice: 10, fulfilment: 'SOON' })).expect(400);
      expect(Object.keys(bad.body.fields)).toEqual(expect.arrayContaining(['price', 'fulfilment']));
      const semantic = await admin.agent.post('/admin/products').send(productBody({ name: `E2E Sem ${stamp}`, compareAtPrice: 10 })).expect(400);
      expect(semantic.body.fields).toHaveProperty('compareAtPrice');
      const cat = await admin.agent.post('/admin/products').send(productBody({ name: `E2E Cat ${stamp}`, category: 'no-such-category' })).expect(400);
      expect(cat.body.fields).toHaveProperty('category');
      expect(await t.prisma.product.count({ where: { slug: { contains: `e2e-cat-${stamp}` } } })).toBe(0);
    });

    it('updates in place: variant ids survive, dropped ones go, new ones are added, images replaced', async () => {
      const p = (await admin.agent.post('/admin/products').send(productBody({ name: `E2E Update ${stamp}` })).expect(201)).body;
      productIds.push(p.id);
      const [keep, drop] = p.variants as { id: string }[];
      const updated = (
        await admin.agent
          .put(`/admin/products/${p.id}`)
          .send(productBody({
            name: `E2E Update ${stamp} v2`, id: p.id, batch: p.batch, createdAt: p.createdAt, price: 1600, compareAtPrice: 1900, status: 'PUBLISHED',
            images: [{ src: '/uploads/e2e-3.jpg', alt: 'new' }],
            variants: [{ id: keep.id, colour: 'Cherry', priceDelta: 0, stock: 9 }, { colour: 'Mint', priceDelta: 25, stock: 2 }],
          }))
          .expect(200)
      ).body;
      expect(updated.slug).toBe(p.slug); // slug is stable unless sent
      expect(updated).toMatchObject({ name: `E2E Update ${stamp} v2`, price: 1600, compareAtPrice: 1900, status: 'PUBLISHED', batch: p.batch });
      expect(updated.images).toEqual([{ src: '/uploads/e2e-3.jpg', alt: 'new' }]);
      expect(updated.variants).toHaveLength(2);
      expect(updated.variants.find((v: { id: string }) => v.id === keep.id)).toMatchObject({ colour: 'Cherry', stock: 9 });
      expect(updated.variants.map((v: { id: string }) => v.id)).not.toContain(drop.id);
      expect(updated.variants.find((v: { colour: string }) => v.colour === 'Mint')).toMatchObject({ priceDelta: 25, stock: 2 });
      // a rejected update changes nothing
      await admin.agent.put(`/admin/products/${p.id}`).send(productBody({ name: 'Should not apply', slug: `e2e-rosie-${stamp}`, images: [] })).expect(409);
      expect((await admin.agent.get(`/admin/products/${p.id}`).expect(200)).body).toEqual(updated);
    });

    it('bulk status: publish needs photos and colours; archive via DELETE; list filters', async () => {
      const empty = (await admin.agent.post('/admin/products').send(productBody({ name: `E2E Empty ${stamp}`, images: [], variants: [] })).expect(201)).body;
      const full = (await admin.agent.post('/admin/products').send(productBody({ name: `E2E Full ${stamp}` })).expect(201)).body;
      productIds.push(empty.id, full.id);
      await admin.agent.post('/admin/products/status').send({ ids: [empty.id, full.id], status: 'PUBLISHED' }).expect(409);
      expect((await admin.agent.get(`/admin/products/${full.id}`).expect(200)).body.status).toBe('DRAFT'); // all or nothing
      expect((await admin.agent.post('/admin/products/status').send({ ids: [full.id], status: 'PUBLISHED' }).expect(200)).body).toEqual({ updated: 1 });
      await admin.agent.post('/admin/products/status').send({ ids: [], status: 'PUBLISHED' }).expect(400);
      expect((await admin.agent.get(`/admin/products?q=E2E Full ${stamp}&status=PUBLISHED`).expect(200)).body.map((x: { id: string }) => x.id)).toEqual([full.id]);
      const archived = (await admin.agent.delete(`/admin/products/${full.id}`).expect(200)).body;
      expect(archived.status).toBe('ARCHIVED');
      expect(await t.prisma.product.count({ where: { id: full.id } })).toBe(1); // archived, never deleted
      expect((await admin.agent.get(`/admin/products?q=${full.batch}`).expect(200)).body.map((x: { id: string }) => x.id)).toContain(full.id);
    });

    it('audits every write', async () => {
      const rows = await t.prisma.auditLog.findMany({ where: { actorId: admin.id, entity: 'Product' }, select: { action: true } });
      expect(new Set(rows.map((r) => r.action))).toEqual(new Set(['product.create', 'product.update', 'product.status', 'product.archive']));
    });
  });

  describe('categories', () => {
    const slug = `e2e-cat-${stamp}`;
    const cat = { slug, name: 'E2E Cat', word: 'e2e', blurb: 'Test', image: '/uploads/cat.jpg' };

    it('upserts by slug, refuses a duplicate create, and blocks deleting a category that has products', async () => {
      const created = (await admin.agent.put(`/admin/categories/${slug}`).send(cat).expect(200)).body;
      expect(created).toEqual(cat);
      expect((await admin.agent.put(`/admin/categories/${slug}`).send({ ...cat, name: 'Renamed' }).expect(200)).body.name).toBe('Renamed');
      await admin.agent.post('/admin/categories').send(cat).expect(409);
      await admin.agent.put(`/admin/categories/${slug}`).send({ ...cat, slug: 'other' }).expect(400);
      expect((await admin.agent.get('/admin/categories').expect(200)).body.map((c: { slug: string }) => c.slug)).toContain(slug);

      const p = (await admin.agent.post('/admin/products').send(productBody({ name: `E2E InCat ${stamp}`, category: slug })).expect(201)).body;
      productIds.push(p.id);
      const blocked = await admin.agent.delete(`/admin/categories/${slug}`).expect(409);
      expect(blocked.body.message).toBe('Move or archive the products in this category first.');
      await t.prisma.product.delete({ where: { id: p.id } });
      await admin.agent.delete(`/admin/categories/${slug}`).expect(204);
      await admin.agent.delete(`/admin/categories/${slug}`).expect(404);
    });
  });

  describe('coupons', () => {
    const code = `E2E${stamp}A`;
    it('creates, upserts, validates and deletes; never overwrites the use counter', async () => {
      const c = (await admin.agent.put(`/admin/coupons/${code.toLowerCase()}`).send({ code: code.toLowerCase(), kind: 'PERCENT', value: 15, minCart: 500, active: true }).expect(200)).body;
      expect(c).toEqual({ code, kind: 'PERCENT', value: 15, minCart: 500, active: true, uses: 0 });
      await t.prisma.coupon.update({ where: { code }, data: { uses: 7 } });
      const edited = (await admin.agent.put(`/admin/coupons/${code}`).send({ code, kind: 'FLAT', value: 100, minCart: 999, active: false, uses: 0, expiresAt: '2030-01-01' }).expect(200)).body;
      expect(edited).toMatchObject({ kind: 'FLAT', value: 100, active: false, uses: 7 });
      expect(edited.expiresAt).toMatch(/^2030-01-01/);
      await admin.agent.post('/admin/coupons').send({ code, kind: 'FLAT', value: 1, minCart: 0, active: true }).expect(409);
      expect((await admin.agent.post('/admin/coupons').send({ code: `E2E${stamp}B`, kind: 'PERCENT', value: 150, minCart: 0, active: true }).expect(400)).body.fields).toHaveProperty('value');
      expect((await admin.agent.post('/admin/coupons').send({ code: 'x', kind: 'PERCENT', value: 5, minCart: 0, active: true }).expect(400)).body.fields).toHaveProperty('code');
      expect((await admin.agent.get('/admin/coupons').expect(200)).body.map((x: { code: string }) => x.code)).toContain(code);
      await admin.agent.delete(`/admin/coupons/${code}`).expect(204);
      await admin.agent.delete(`/admin/coupons/${code}`).expect(404);
    });
  });

  describe('materials', () => {
    const name = `E2E Material ${stamp}`;
    let id: string;

    it('creates, lists, updates, adjusts stock and archives; archived is excluded from the default list', async () => {
      const created = (
        await admin.agent.post('/admin/materials').send({ name, unit: 'skein', costPerUnit: 180, qtyOnHand: 12, lowStockAt: 3 }).expect(201)
      ).body;
      id = created.id;
      expect(created).toMatchObject({ name, unit: 'skein', costPerUnit: 180, qtyOnHand: 12, lowStockAt: 3, archived: false });
      expect(created).not.toHaveProperty('notes');

      const listed = (await admin.agent.get('/admin/materials').expect(200)).body;
      expect(listed.map((m: { id: string }) => m.id)).toContain(id);

      const edited = (
        await admin.agent.put(`/admin/materials/${id}`).send({ name, unit: 'skein', costPerUnit: 200, qtyOnHand: 12, notes: 'From the usual supplier' }).expect(200)
      ).body;
      expect(edited).toMatchObject({ costPerUnit: 200, notes: 'From the usual supplier' });
      expect(edited).not.toHaveProperty('lowStockAt'); // omitting it on update clears the threshold

      const afterUse = (await admin.agent.post(`/admin/materials/${id}/adjust-stock`).send({ delta: -4.5, reason: 'Used on a piece' }).expect(200)).body;
      expect(afterUse.qtyOnHand).toBe(7.5);
      const afterRestock = (await admin.agent.post(`/admin/materials/${id}/adjust-stock`).send({ delta: 2 }).expect(200)).body;
      expect(afterRestock.qtyOnHand).toBe(9.5);

      await admin.agent.delete(`/admin/materials/${id}`).expect(204);
      const afterArchive = (await admin.agent.get('/admin/materials').expect(200)).body;
      expect(afterArchive.map((m: { id: string }) => m.id)).not.toContain(id);
      await admin.agent.delete(`/admin/materials/${id}`).expect(404); // already archived: not found again
    });

    it('rejects bad input with field errors and an unknown id with 404', async () => {
      expect((await admin.agent.post('/admin/materials').send({ name: '', unit: 'skein', costPerUnit: 10, qtyOnHand: 1 }).expect(400)).body.fields).toHaveProperty('name');
      expect((await admin.agent.post('/admin/materials').send({ name: 'X', unit: 'skein', costPerUnit: -5, qtyOnHand: 1 }).expect(400)).body.fields).toHaveProperty('costPerUnit');
      await admin.agent.put('/admin/materials/does-not-exist').send({ name: 'X', unit: 'skein', costPerUnit: 1, qtyOnHand: 1 }).expect(404);
      await admin.agent.post('/admin/materials/does-not-exist/adjust-stock').send({ delta: -1 }).expect(404);
    });
  });

  describe('orders (delegating to OrderStateService)', () => {
    it('lists with the admin tabs and search, and reads one order in the web shape', async () => {
      await makeOrder(11, { status: 'PLACED', paymentMethod: 'COD', paymentStatus: 'COD_DUE' });
      const toConfirm = (await admin.agent.get('/admin/orders?status=TO_CONFIRM').expect(200)).body;
      expect(toConfirm.map((o: { number: string }) => o.number)).toContain(`${orderPrefix}-11`);
      expect(toConfirm.every((o: { paymentMethod: string; status: string }) => o.paymentMethod === 'COD' && o.status === 'PLACED')).toBe(true);
      const search = (await admin.agent.get(`/admin/orders?q=${orderPrefix}-11`).expect(200)).body;
      expect(search).toHaveLength(1);
      expect(search[0]).toMatchObject({ number: `${orderPrefix}-11`, currency: 'INR', contact: { name: 'E2E Buyer' }, items: [expect.objectContaining({ name: 'E2E Bear', qty: 1 })], hidePrices: false });
      expect(search[0]).not.toHaveProperty('contactEmail');
      await admin.agent.get('/admin/orders?status=NOPE').expect(400);
      await admin.agent.get('/admin/orders/NOPE-1').expect(404);
    });

    it('moves status through the state machine: illegal → 409, SHIPPED needs courier + awb, events accumulate', async () => {
      const n = `${orderPrefix}-12`;
      await makeOrder(12, { status: 'CONFIRMED' });
      await admin.agent.post(`/admin/orders/${n}/status`).send({ status: 'DELIVERED' }).expect(409);
      expect((await admin.agent.post(`/admin/orders/${n}/status`).send({ status: 'PACKED', note: 'Wrapped in kraft' }).expect(200)).body.status).toBe('PACKED');
      const noAwb = await admin.agent.post(`/admin/orders/${n}/status`).send({ status: 'SHIPPED', courier: 'Delhivery' }).expect(400);
      expect(noAwb.body.fields).toHaveProperty('awb');
      const shipped = (await admin.agent.post(`/admin/orders/${n}/status`).send({ status: 'SHIPPED', courier: 'Delhivery', awb: 'DL1' }).expect(200)).body;
      expect(shipped).toMatchObject({ status: 'SHIPPED', courier: 'Delhivery', awb: 'DL1' });
      expect(shipped.events.map((e: { status: string }) => e.status)).toEqual(['PLACED', 'PACKED', 'SHIPPED']);
      expect(t.sent.at(-1)).toMatchObject({ event: 'order.shipped' });
      await admin.agent.post(`/admin/orders/${n}/status`).send({ status: 'BOGUS' }).expect(400);
      const audit = await t.prisma.auditLog.findMany({ where: { entity: 'Order', entityId: n }, select: { action: true } });
      expect(audit).toHaveLength(2);
    });

    it('notes are admin-only; the packing slip hides prices for gifts', async () => {
      const n = `${orderPrefix}-13`;
      await makeOrder(13, { hidePrices: true, giftNote: 'Happy birthday!', giftWrap: 59, total: 1059 });
      const noted = (await admin.agent.patch(`/admin/orders/${n}/notes`).send({ notes: 'Customer wants it before Friday' }).expect(200)).body;
      expect(noted.notes).toBe('Customer wants it before Friday');
      const slip = (await admin.agent.get(`/admin/orders/${n}/packing-slip`).expect(200)).body;
      expect(slip).toMatchObject({ number: n, hidePrices: true, giftWrap: true, giftNote: 'Happy birthday!', notes: 'Customer wants it before Friday' });
      expect(slip).not.toHaveProperty('total');
      expect(slip.items[0]).not.toHaveProperty('unitPrice');
      const cleared = (await admin.agent.patch(`/admin/orders/${n}/notes`).send({ notes: '' }).expect(200)).body;
      expect(cleared).not.toHaveProperty('notes');
    });
  });

  describe('customers, reviews, settings', () => {
    it('lists customers with order/work-order/spend totals (paid orders only) and shows one in detail', async () => {
      await makeOrder(21, { userId: customer.id, total: 700, subtotal: 700, paymentStatus: 'PAID' });
      await makeOrder(22, { userId: customer.id, total: 300, subtotal: 300, paymentStatus: 'PENDING', status: 'PENDING_PAYMENT' });
      const rows = (await admin.agent.get(`/admin/customers?q=${encodeURIComponent(customer.email)}`).expect(200)).body;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: customer.id, email: customer.email, role: 'customer', orders: 2, workOrders: 0, spent: 700 });
      expect(rows[0]).not.toHaveProperty('passwordHash');
      const detail = (await admin.agent.get(`/admin/customers/${customer.id}`).expect(200)).body;
      expect(detail.user.id).toBe(customer.id);
      expect(detail.orders.map((o: { number: string }) => o.number).sort()).toEqual([`${orderPrefix}-21`, `${orderPrefix}-22`]);
      expect(detail.custom).toEqual([]);
      await admin.agent.get(`/admin/customers/${admin.id}`).expect(404); // admins are not customers
    });

    it('moderates reviews and keeps the product rating in step', async () => {
      const product = await t.prisma.product.findFirstOrThrow({ where: { id: { in: productIds } } });
      const review = await t.prisma.review.create({ data: { productId: product.id, userId: customer.id, author: `E2E ${stamp}`, rating: 4, body: 'Lovely', verified: true } });
      expect((await admin.agent.get('/admin/reviews?status=PENDING').expect(200)).body.map((r: { id: string }) => r.id)).toContain(review.id);
      const published = (await admin.agent.patch(`/admin/reviews/${review.id}`).send({ status: 'PUBLISHED' }).expect(200)).body;
      expect(published).toMatchObject({ id: review.id, status: 'PUBLISHED', rating: 4, author: `E2E ${stamp}`, verified: true });
      expect(await t.prisma.product.findUniqueOrThrow({ where: { id: product.id }, select: { ratingAverage: true, ratingCount: true } })).toEqual({ ratingAverage: 4, ratingCount: 1 });
      await admin.agent.patch(`/admin/reviews/${review.id}`).send({ status: 'HIDDEN' }).expect(200);
      expect(await t.prisma.product.findUniqueOrThrow({ where: { id: product.id }, select: { ratingAverage: true, ratingCount: true } })).toEqual({ ratingAverage: 0, ratingCount: 0 });
      await admin.agent.patch(`/admin/reviews/${review.id}`).send({ status: 'NOPE' }).expect(400);
      await admin.agent.patch('/admin/reviews/nope').send({ status: 'HIDDEN' }).expect(404);
    });

    it('disputes a review with a reason (admin-only, distinct from a plain hide) and lets the maker reply publicly', async () => {
      const product = await t.prisma.product.findFirstOrThrow({ where: { id: { in: productIds } } });
      const review = await t.prisma.review.create({ data: { productId: product.id, userId: customer.id, author: `E2E ${stamp}`, rating: 5, body: 'Great yarn', verified: true, status: 'PUBLISHED' } });

      // a customer can't self-dispute or reply: the admin routes are admin-only (401 for a guest, 403 for a customer)
      await customer.agent.patch(`/admin/reviews/${review.id}`).send({ status: 'DISPUTED', disputeReason: 'Not real' }).expect(403);
      await customer.agent.put(`/admin/reviews/${review.id}/reply`).send({ reply: 'Hi' }).expect(403);
      await request(app.getHttpServer()).patch(`/admin/reviews/${review.id}`).send({ status: 'DISPUTED', disputeReason: 'Not real' }).expect(401);

      // moving to DISPUTED requires a reason
      await admin.agent.patch(`/admin/reviews/${review.id}`).send({ status: 'DISPUTED' }).expect(400);
      const disputed = (await admin.agent.patch(`/admin/reviews/${review.id}`).send({ status: 'DISPUTED', disputeReason: 'False claim about the fibre used.' }).expect(200)).body;
      expect(disputed).toMatchObject({ id: review.id, status: 'DISPUTED', disputeReason: 'False claim about the fibre used.' });

      // never shown publicly (same as HIDDEN), and tracked distinctly from a plain hide
      expect(await t.prisma.product.findUniqueOrThrow({ where: { id: product.id }, select: { ratingAverage: true, ratingCount: true } })).toEqual({ ratingAverage: 0, ratingCount: 0 });
      expect((await customer.agent.get(`/products/${product.id}/reviews`).expect(200)).body).toEqual([]);
      expect((await admin.agent.get('/admin/reviews?status=DISPUTED').expect(200)).body.map((r: { id: string }) => r.id)).toContain(review.id);
      expect((await admin.agent.get('/admin/reviews?status=HIDDEN').expect(200)).body.map((r: { id: string }) => r.id)).not.toContain(review.id);

      // publishing it again keeps the reason for the record
      const republished = (await admin.agent.patch(`/admin/reviews/${review.id}`).send({ status: 'PUBLISHED' }).expect(200)).body;
      expect(republished).toMatchObject({ status: 'PUBLISHED', disputeReason: 'False claim about the fibre used.' });
      // the reason is never part of the public shape, dispute or not
      expect((await customer.agent.get(`/products/${product.id}/reviews`).expect(200)).body[0]).not.toHaveProperty('disputeReason');

      // the maker's reply appears in the public DTO, separate from the review body
      const replied = (await admin.agent.put(`/admin/reviews/${review.id}/reply`).send({ reply: 'Thanks for the feedback — this piece is 100% cotton.' }).expect(200)).body;
      expect(replied).toMatchObject({ reply: 'Thanks for the feedback — this piece is 100% cotton.' });
      expect(replied.repliedAt).toBeTruthy();
      const publicList = (await customer.agent.get(`/products/${product.id}/reviews`).expect(200)).body;
      expect(publicList).toHaveLength(1);
      expect(publicList[0]).toMatchObject({ id: review.id, reply: 'Thanks for the feedback — this piece is 100% cotton.' });

      await admin.agent.delete(`/admin/reviews/${review.id}/reply`).expect(200);
      expect((await customer.agent.get(`/products/${product.id}/reviews`).expect(200)).body[0]).not.toHaveProperty('reply');

      await admin.agent.put(`/admin/reviews/${review.id}/reply`).send({ reply: '' }).expect(400);
      await admin.agent.put('/admin/reviews/nope/reply').send({ reply: 'Hi' }).expect(404);
      await admin.agent.delete('/admin/reviews/nope/reply').expect(404);
    });

    it('settings: validated full replace, persisted, visible to the public endpoint, audited', async () => {
      const next = { ...originalSettings, depositPct: 40, quoteValidityDays: 10, codCap: 2500 };
      expect((await admin.agent.put('/admin/settings').send(next).expect(200)).body).toEqual(next);
      expect((await admin.agent.get('/admin/settings').expect(200)).body).toEqual(next);
      expect((await customer.agent.get('/settings').expect(200)).body).toMatchObject({ depositPct: 40, codCap: 2500 });
      const bad = await admin.agent.put('/admin/settings').send({ ...next, depositPct: 0, email: 'nope', intlZones: [] }).expect(400);
      expect(Object.keys(bad.body.fields)).toEqual(expect.arrayContaining(['depositPct', 'email', 'intlZones']));
      await admin.agent.put('/admin/settings').send({ ...next, surprise: true }).expect(400);
      const audit = await t.prisma.auditLog.findFirstOrThrow({ where: { actorId: admin.id, action: 'settings.update' }, orderBy: { createdAt: 'desc' } });
      expect(audit.meta).toMatchObject({ depositPct: [originalSettings.depositPct, 40], quoteValidityDays: [originalSettings.quoteValidityDays, 10] });
      // a quote sent now snapshots the NEW deposit %
      await admin.agent.put('/admin/settings').send(originalSettings).expect(200);
    });
  });
});
