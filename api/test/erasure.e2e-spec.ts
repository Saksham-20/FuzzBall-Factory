import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { AuthService } from '../src/auth/auth.service.js';
import { ERASURE_GRACE_DAYS, ErasureService } from '../src/account/erasure.service.js';
import { makeUser, PASSWORD, type TestUser } from './helpers/e2e.js';
import { bootCommerce, cleanupCommerce, makeProduct, MOCK_PAYMENT_ENV, type CommerceApp, type Fixture } from './helpers/commerce.js';

describe('account export and erasure (e2e)', () => {
  const TAG = `era${Date.now()}`;
  let t: CommerceApp;
  let dir: string;
  let erasure: ErasureService;
  let fx: Fixture;
  let admin: TestUser;
  const userIds: string[] = [];
  const day = 86_400_000;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fbf-era-'));
    t = await bootCommerce({ env: { ...MOCK_PAYMENT_ENV, UPLOADS_DIR: dir, CLOUDINARY_URL: undefined } });
    erasure = t.app.get(ErasureService);
    fx = await makeProduct(t.prisma, TAG, { stock: 20 });
    admin = await makeUser(t, 'admin', `${TAG}-admin`);
    userIds.push(admin.id);
  });
  afterAll(async () => {
    await t.prisma.customRequest.deleteMany({ where: { userId: { in: userIds } } });
    await t.prisma.upload.deleteMany({ where: { userId: { in: userIds } } });
    await cleanupCommerce(t.prisma, { tags: [TAG], userIds });
    t.restoreEnv();
    await t.app.close();
    await rm(dir, { recursive: true, force: true });
  });

  /** A customer with a bit of everything: address, wishlist, a delivered order with a gift note, a paid payment, a work order with messages and a photo, a published review, an upload. */
  async function fullCustomer(label: string) {
    const u = await makeUser(t, 'customer', `${TAG}-${label}`);
    userIds.push(u.id);
    await t.prisma.user.update({ where: { id: u.id }, data: { phone: `+9198${Math.floor(10_000_000 + Math.random() * 89_999_999)}` } });
    await t.prisma.address.create({ data: { userId: u.id, label: 'Home', name: 'Maya Iyer', phone: '+919811122233', line1: '12 Test Street', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'IN' } });
    await t.prisma.wishlistItem.create({ data: { userId: u.id, productId: fx.productId } });
    const order = await t.prisma.order.create({
      data: {
        number: `FB-${TAG}-${label}`, userId: u.id, contact: { name: 'Maya Iyer', email: u.email, phone: '+919811122233' }, contactEmail: u.email, contactPhone: '+919811122233',
        address: { name: 'Maya Iyer', phone: '+919811122233', line1: '12 Test Street', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'IN' },
        subtotal: 400, total: 479, paymentMethod: 'RAZORPAY', paymentStatus: 'PAID', status: 'DELIVERED', giftNote: 'Love, Maya', notes: 'called her twice', estimatedDispatch: new Date(),
        items: { create: [{ productId: fx.productId, variantId: fx.variantId, name: 'Bear', image: '/a.jpg', colour: 'Cream', qty: 1, unitPrice: 400, fulfilment: 'READY' }] },
        events: { create: [{ status: 'DELIVERED', note: 'Left with the neighbour, Mrs Rao' }] },
      },
    });
    const payment = await t.prisma.payment.create({ data: { purpose: 'ORDER', amount: 479, orderId: order.id, status: 'PAID', paidAt: new Date() } });
    const png = await sharp({ create: { width: 30, height: 30, channels: 3, background: '#c98586' } }).png().toBuffer();
    const up = await u.agent.post('/uploads').attach('file', png, { filename: 'a.png', contentType: 'image/png' }).expect(201);
    const wo = await t.prisma.customRequest.create({
      data: {
        number: `WO-${TAG}-${label}`, userId: u.id, customerName: 'Maya Iyer', customerPhone: '+919811122233', category: 'toys', title: 'Bear for Priya', description: 'A bear for my daughter Priya, born 4 May, in pink.', colours: ['Pink'],
        budgetMin: 500, budgetMax: 900, personalization: 'Priya', occasion: 'Birthday', address: { line1: '12 Test Street' }, status: 'CLOSED',
        images: { create: [{ url: up.body.url as string }] },
        messages: { create: [{ author: 'customer', body: 'Please use the softest yarn, Priya is allergic to wool' }] },
        events: { create: [{ status: 'CLOSED', note: 'Delivered to Priya' }] },
      },
    });
    const review = await t.prisma.review.create({ data: { productId: fx.productId, userId: u.id, orderId: order.id, author: 'Maya', rating: 4, body: 'Lovely, Priya adores it.', status: 'PUBLISHED', verified: true } });
    return { u, order, payment, wo, review, uploadUrl: up.body.url as string };
  }
  const ask = (id: string, daysAgo = ERASURE_GRACE_DAYS + 1) => t.prisma.user.update({ where: { id }, data: { deletionRequestedAt: new Date(Date.now() - daysAgo * day) } });
  const filesOnDisk = async () => (await readdir(join(dir, 'uploads')).catch(() => [] as string[])).length;

  it('exports everything the shop holds about the caller, and only theirs', async () => {
    const a = await fullCustomer('exp-a');
    const b = await fullCustomer('exp-b');
    const res = await a.u.agent.get('/account/export').expect(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="fuzzball-data-\d{4}-\d{2}-\d{2}\.json"/);
    expect(res.headers['cache-control']).toBe('no-store');
    const doc = res.body as Record<string, any>;
    expect(doc.profile).toMatchObject({ id: a.u.id, email: a.u.email });
    expect(doc.addresses).toHaveLength(1);
    expect(doc.orders.map((o: { number: string }) => o.number)).toEqual([a.order.number]);
    expect(doc.orders[0].contact.name).toBe('Maya Iyer');
    expect(doc.workOrders[0].messages[0].body).toMatch(/softest yarn/);
    expect(doc.payments).toEqual([expect.objectContaining({ amount: 479, order: a.order.number })]);
    expect(doc.reviews[0]).toMatchObject({ rating: 4 });
    expect(doc.wishlist).toHaveLength(1);
    expect(doc.uploads[0].url).toBe(a.uploadUrl);
    const text = JSON.stringify(doc);
    for (const other of [b.u.email, b.order.number, b.wo.number, b.uploadUrl]) expect(text).not.toContain(other);
    expect(text).not.toMatch(/passwordHash|tokenVersion|\$argon2/);
  });

  it('a deletion request can be withdrawn, and shows on the profile while it waits', async () => {
    const { u } = await fullCustomer('cancel');
    await u.agent.post('/account/delete-request').expect(204);
    expect((await u.agent.get('/account/profile').expect(200)).body.deletionRequestedAt).toEqual(expect.any(String));
    await u.agent.post('/account/delete-request/cancel').expect(204);
    expect((await u.agent.get('/account/profile').expect(200)).body).not.toHaveProperty('deletionRequestedAt');
    await u.agent.post('/account/delete-request/cancel').expect(204); // nothing pending: fine
    expect(await erasure.erase(u.id)).toBe('skipped'); // never requested, so never erased
  });

  it('nothing happens before the grace period is over', async () => {
    const { u } = await fullCustomer('early');
    await ask(u.id, ERASURE_GRACE_DAYS - 2);
    await erasure.processDue();
    expect((await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).erasedAt).toBeNull();
  });

  it('erases the personal data and keeps the money trail', async () => {
    const c = await fullCustomer('gone');
    await t.prisma.product.update({ where: { id: fx.productId }, data: { ratingCount: 99, ratingAverage: 1 } }); // stale on purpose
    const filesBefore = await filesOnDisk();
    await ask(c.u.id);
    const sentBefore = t.sent.length;

    expect(await erasure.erase(c.u.id)).toBe('erased');

    const user = await t.prisma.user.findUniqueOrThrow({ where: { id: c.u.id } });
    expect(user).toMatchObject({ name: 'Deleted customer', email: `erased-${c.u.id}@erased.invalid`, phone: null, emailVerified: false });
    expect(user.erasedAt).not.toBeNull();
    expect(user.passwordHash).not.toMatch(/^\$argon2/);

    // gone
    expect(await t.prisma.address.count({ where: { userId: c.u.id } })).toBe(0);
    expect(await t.prisma.wishlistItem.count({ where: { userId: c.u.id } })).toBe(0);
    expect(await t.prisma.refreshToken.count({ where: { userId: c.u.id } })).toBe(0);
    expect(await t.prisma.review.count({ where: { userId: c.u.id } })).toBe(0);
    expect(await t.prisma.customMessage.count({ where: { requestId: c.wo.id } })).toBe(0);
    expect(await t.prisma.customRequestImage.count({ where: { requestId: c.wo.id } })).toBe(0);
    expect(await t.prisma.upload.count({ where: { userId: c.u.id } })).toBe(0);
    expect(await filesOnDisk()).toBe(filesBefore - 1);
    const stillPublished = await t.prisma.review.count({ where: { productId: fx.productId, status: 'PUBLISHED' } });
    expect((await t.prisma.product.findUniqueOrThrow({ where: { id: fx.productId }, select: { ratingCount: true } })).ratingCount).toBe(stillPublished); // rating recomputed without the erased review

    // scrubbed but kept
    const order = await t.prisma.order.findUniqueOrThrow({ where: { id: c.order.id }, include: { events: true, items: true } });
    expect(order).toMatchObject({ subtotal: 400, total: 479, status: 'DELIVERED', paymentStatus: 'PAID', giftNote: null, notes: null, contactPhone: '' });
    expect(order.contactEmail).toBe(`erased-${c.order.id}@erased.invalid`);
    expect(JSON.stringify([order.contact, order.address])).not.toMatch(/Maya|Test Street|Bengaluru|560038|9811122233|@/);
    expect(order.events[0]!.note).toBeNull();
    expect(order.items).toHaveLength(1);
    expect(await t.prisma.payment.findUniqueOrThrow({ where: { id: c.payment.id } })).toMatchObject({ amount: 479, status: 'PAID', orderId: c.order.id });
    const wo = await t.prisma.customRequest.findUniqueOrThrow({ where: { id: c.wo.id }, include: { events: true } });
    expect(wo).toMatchObject({ customerName: 'Deleted customer', customerPhone: '', description: '[erased]', personalization: null, occasion: null, address: null });
    expect(JSON.stringify(wo)).not.toMatch(/Priya|Maya|Test Street/);
    expect(wo.events[0]!.note).toBeNull();

    // the person can no longer sign in, was told, and an audit row records it
    await expect(t.app.get(AuthService).login(c.u.email, PASSWORD, {})).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
    await c.u.agent.get('/auth/me').expect(401);
    expect(t.sent.slice(sentBefore).some((s) => s.event === 'auth.account_erased' && s.payload.to === c.u.email)).toBe(true);
    expect(await t.prisma.auditLog.count({ where: { actorId: c.u.id, action: 'account.erased' } })).toBe(1);

    // once is enough
    expect(await erasure.erase(c.u.id)).toBe('skipped');
  });

  it('waits while an order, a work order or a refund is still open, then goes through', async () => {
    const c = await fullCustomer('busy');
    await ask(c.u.id);

    await t.prisma.order.update({ where: { id: c.order.id }, data: { status: 'SHIPPED' } });
    expect(await erasure.erase(c.u.id)).toBe('deferred');
    await t.prisma.order.update({ where: { id: c.order.id }, data: { status: 'DELIVERED' } });

    await t.prisma.customRequest.update({ where: { id: c.wo.id }, data: { status: 'IN_PROGRESS' } });
    expect(await erasure.erase(c.u.id)).toBe('deferred');
    await t.prisma.customRequest.update({ where: { id: c.wo.id }, data: { status: 'CLOSED' } });

    const refund = await t.prisma.refundJob.create({ data: { paymentId: c.payment.id, amount: 100, reason: 'test', status: 'PENDING' } });
    expect(await erasure.erase(c.u.id)).toBe('deferred');
    expect((await t.prisma.user.findUniqueOrThrow({ where: { id: c.u.id } })).erasedAt).toBeNull(); // nothing was touched while waiting
    expect(await t.prisma.address.count({ where: { userId: c.u.id } })).toBe(1);
    await t.prisma.refundJob.update({ where: { id: refund.id }, data: { status: 'DONE' } });

    expect(await erasure.erase(c.u.id)).toBe('erased');
    await t.prisma.refundJob.deleteMany({ where: { id: refund.id } });
  });

  it('the export of an erased account is gone, and staff accounts are never erased', async () => {
    const c = await fullCustomer('after');
    await ask(c.u.id);
    await erasure.erase(c.u.id);
    await c.u.agent.get('/account/export').expect(401); // its sessions are dead too

    await t.prisma.user.update({ where: { id: admin.id }, data: { deletionRequestedAt: new Date(Date.now() - 60 * day) } });
    expect(await erasure.erase(admin.id)).toBe('skipped');
    await erasure.processDue();
    expect((await t.prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).erasedAt).toBeNull();
  });
});
