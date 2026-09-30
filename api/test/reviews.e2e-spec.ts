import { OrderStateService, SYSTEM_ACTOR } from '../src/orders/order-state.service.js';
import { makeUser, type TestUser } from './helpers/e2e.js';
import { bootCommerce, cleanupCommerce, guest, makeProduct, MOCK_PAYMENT_ENV, orderBody, type CommerceApp, type Fixture } from './helpers/commerce.js';

/** Review abuse: who may review, once, moderation before publishing, and a rating that stays right under concurrency. */
describe('reviews (e2e)', () => {
  const TAG = `rev${Date.now()}`;
  let t: CommerceApp;
  let state: OrderStateService;
  let fx: Fixture;
  let admin: TestUser;
  const buyers: TestUser[] = [];
  const http = () => guest(t);

  const newUser = async (label: string) => {
    const u = await makeUser(t, 'customer', `${TAG}-${label}`);
    buyers.push(u);
    return u;
  };
  const buy = async (u: TestUser, name: string, method: 'COD' | 'RAZORPAY' = 'COD') =>
    (await u.agent.post('/orders').send(orderBody(`${TAG}-${name}`, [{ productId: fx.productId, variantId: fx.variantId }], { paymentMethod: method })).expect(201)).body as { number: string };
  const deliver = async (n: string) => {
    for (const to of ['CONFIRMED', 'PACKED'] as const) await state.transition(n, to, SYSTEM_ACTOR);
    await state.transition(n, 'SHIPPED', SYSTEM_ACTOR, { courier: 'X', awb: '1' });
    await state.transition(n, 'DELIVERED', SYSTEM_ACTOR);
  };
  const review = (u: TestUser, rating = 5) => u.agent.post('/reviews').send({ productId: fx.productId, rating, body: 'Soft and well made, arrived quickly.' });
  const product = () => t.prisma.product.findUniqueOrThrow({ where: { id: fx.productId }, select: { ratingAverage: true, ratingCount: true } });

  beforeAll(async () => {
    t = await bootCommerce({ env: MOCK_PAYMENT_ENV });
    state = t.app.get(OrderStateService);
    fx = await makeProduct(t.prisma, TAG, { stock: 50 });
    admin = await makeUser(t, 'admin', `${TAG}-admin`);
  });
  afterAll(async () => {
    await cleanupCommerce(t.prisma, { tags: [TAG], userIds: [...buyers.map((u) => u.id), admin.id] });
    t.restoreEnv();
    await t.app.close();
  });

  it('only a customer whose own order was delivered may review: not a guest, an admin, a neighbour, or an undelivered/cancelled buyer', async () => {
    const carol = await newUser('carol');
    const dave = await newUser('dave');
    await http().post('/reviews').send({ productId: fx.productId, rating: 5, body: 'Nice one' }).expect(401);

    const pending = await buy(carol, 'carol-pending');
    await review(carol).expect(403); // ordered, not delivered
    await state.transition(pending.number, 'CANCELLED', SYSTEM_ACTOR);
    await review(carol).expect(403); // cancelled

    const delivered = await buy(dave, 'dave');
    await deliver(delivered.number);
    await review(carol).expect(403); // someone else's delivered order is no proof of purchase
    await review(admin).expect(403); // staff have no special claim either

    await review(dave).expect(201);
  });

  it('rejects out-of-range ratings, unknown products, and fields a client must never set', async () => {
    const erin = await newUser('erin');
    await deliver((await buy(erin, 'erin')).number);
    await erin.agent.post('/reviews').send({ productId: fx.productId, rating: 0, body: 'Nope nope' }).expect(400);
    await erin.agent.post('/reviews').send({ productId: fx.productId, rating: 5.5, body: 'Nope nope' }).expect(400);
    await erin.agent.post('/reviews').send({ productId: 'no-such-product', rating: 5, body: 'Nope nope' }).expect(404);
    await erin.agent.post('/reviews').send({ productId: fx.productId, rating: 5, body: 'Sneaky', verified: false, status: 'PUBLISHED', userId: 'x' }).expect(400);
    const ok = await review(erin, 4).expect(201);
    expect(ok.body).toMatchObject({ status: 'PENDING', verified: true });
  });

  it('two submissions at the same instant leave exactly one review', async () => {
    const finn = await newUser('finn');
    await deliver((await buy(finn, 'finn')).number);
    const results = await Promise.all([review(finn), review(finn), review(finn)]);
    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([201, 409, 409]);
    expect(await t.prisma.review.count({ where: { userId: finn.id, productId: fx.productId } })).toBe(1);
  });

  it('nothing is public or counted until the maker publishes it; hiding takes it back out', async () => {
    const gina = await newUser('gina');
    await deliver((await buy(gina, 'gina')).number);
    const r = (await review(gina, 3).expect(201)).body as { id: string };
    const before = await product();
    expect((await http().get(`/products/${fx.productId}/reviews`).expect(200)).body.map((x: { id: string }) => x.id)).not.toContain(r.id);

    await admin.agent.patch(`/admin/reviews/${r.id}`).send({ status: 'PUBLISHED' }).expect(200);
    expect((await http().get(`/products/${fx.productId}/reviews`).expect(200)).body.map((x: { id: string }) => x.id)).toContain(r.id);
    expect((await product()).ratingCount).toBe(before.ratingCount + 1);

    await admin.agent.patch(`/admin/reviews/${r.id}`).send({ status: 'DISPUTED' }).expect(400); // needs a reason
    await admin.agent.patch(`/admin/reviews/${r.id}`).send({ status: 'HIDDEN' }).expect(200);
    expect((await http().get(`/products/${fx.productId}/reviews`).expect(200)).body.map((x: { id: string }) => x.id)).not.toContain(r.id);
    expect((await product()).ratingCount).toBe(before.ratingCount);
    await buyers[0]!.agent.patch(`/admin/reviews/${r.id}`).send({ status: 'PUBLISHED' }).expect(403); // customers cannot moderate
  });

  it('moderating several reviews of one product at once keeps the rating exact', async () => {
    const users = await Promise.all(['h1', 'h2', 'h3', 'h4'].map(newUser));
    const ratings = [5, 4, 2, 1];
    const ids: string[] = [];
    for (const [i, u] of users.entries()) {
      await deliver((await buy(u, `race-${i}`)).number);
      ids.push(((await review(u, ratings[i]!).expect(201)).body as { id: string }).id);
    }
    await Promise.all(ids.map((id) => admin.agent.patch(`/admin/reviews/${id}`).send({ status: 'PUBLISHED' }).expect(200)));

    const published = await t.prisma.review.findMany({ where: { productId: fx.productId, status: 'PUBLISHED' }, select: { rating: true } });
    const p = await product();
    expect(p.ratingCount).toBe(published.length);
    expect(p.ratingAverage).toBeCloseTo(published.reduce((s, x) => s + x.rating, 0) / published.length, 5);
  });
});
