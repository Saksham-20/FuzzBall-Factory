import { bootCommerce, cleanupCommerce, guest, makeProduct, MOCK_PAYMENT_ENV, orderBody, type CommerceApp, type Fixture } from './helpers/commerce.js';
import { makeUser, type TestUser } from './helpers/e2e.js';

/** Coupon limits that hold under concurrency: total uses (maxUses) and uses per customer (perUserLimit). */
const TAG = `cpl${Date.now()}`;
const ONCE = `${TAG}-ONCE`.toUpperCase();
const TWICE = `${TAG}-TWICE`.toUpperCase();
const TWO_TOTAL = `${TAG}-CAP`.toUpperCase();
const ADMIN_CODE = `${TAG}-ADM`.toUpperCase();

describe('coupon limits (e2e)', () => {
  let t: CommerceApp;
  let fx: Fixture;
  let admin: TestUser;
  let shopper: TestUser;
  const codes = [ONCE, TWICE, TWO_TOTAL, ADMIN_CODE];

  const place = (name: string, coupon: string, email = `${TAG}-${name}@e2e.test`, agent = guest(t)) =>
    agent.post('/orders').send(orderBody(`${TAG}-${name}`, [{ productId: fx.productId, variantId: fx.variantId }], { coupon, paymentMethod: 'COD', contact: { name: 'E2E', email, phone: '9811122233' } }));

  beforeAll(async () => {
    t = await bootCommerce({ env: MOCK_PAYMENT_ENV });
    fx = await makeProduct(t.prisma, TAG, { stock: 40, price: 500 });
    admin = await makeUser(t, 'admin', `${TAG}a`);
    shopper = await makeUser(t, 'customer', `${TAG}s`);
    await t.prisma.coupon.createMany({
      data: [
        { code: ONCE, kind: 'FLAT', value: 50, perUserLimit: 1 },
        { code: TWICE, kind: 'FLAT', value: 50, perUserLimit: 2 },
        { code: TWO_TOTAL, kind: 'FLAT', value: 50, maxUses: 2 },
      ],
    });
  });
  afterAll(async () => {
    await cleanupCommerce(t.prisma, { tags: [TAG], couponCodes: codes, userIds: [admin.id, shopper.id] });
    t.restoreEnv();
    await t.app.close();
  });

  it('a guest can use a one-per-customer code once, even when the same email fires two orders at the same moment', async () => {
    const email = `${TAG}-race@e2e.test`;
    const results = await Promise.all([place('race-1', ONCE, email), place('race-2', ONCE, email), place('race-3', ONCE, email)]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    for (const r of results.filter((x) => x.status !== 201)) expect(r.body).toMatchObject({ code: 'COUPON_INVALID', fields: { coupon: 'Already used' } });
    expect(await t.prisma.couponRedemption.count({ where: { coupon: { code: ONCE } } })).toBe(1);
    expect((await t.prisma.coupon.findUniqueOrThrow({ where: { code: ONCE } })).uses).toBe(1);
    // A different customer still can; the email match is case-insensitive.
    await place('race-other', ONCE, `${TAG}-other@e2e.test`).expect(201);
    await place('race-again', ONCE, email.toUpperCase()).expect(400);
  });

  it('the failed attempts leave no stock taken and no redemption behind', async () => {
    const before = (await t.prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantId } })).stock;
    await place('stock-1', ONCE, `${TAG}-race@e2e.test`).expect(400);
    expect((await t.prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantId } })).stock).toBe(before);
  });

  it('a logged-in customer is counted by account, a limit of two allows exactly two', async () => {
    const results = await Promise.all([1, 2, 3, 4].map((n) => place(`acct-${n}`, TWICE, `${TAG}-acct-${n}@e2e.test`, shopper.agent)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect(await t.prisma.couponRedemption.count({ where: { coupon: { code: TWICE }, userId: shopper.id } })).toBe(2);
  });

  it('maxUses (total) still caps concurrent redemptions across different customers', async () => {
    const results = await Promise.all([1, 2, 3, 4].map((n) => place(`cap-${n}`, TWO_TOTAL)));
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect((await t.prisma.coupon.findUniqueOrThrow({ where: { code: TWO_TOTAL } })).uses).toBe(2);
  });

  it('admin can set and clear maxUses / perUserLimit; leaving them out keeps the stored values', async () => {
    const base = { code: ADMIN_CODE, kind: 'PERCENT', value: 10, minCart: 0, active: true };
    const created = (await admin.agent.post('/admin/coupons').send({ ...base, maxUses: 5, perUserLimit: 1 }).expect(201)).body;
    expect(created).toMatchObject({ code: ADMIN_CODE, maxUses: 5, perUserLimit: 1 });
    const kept = (await admin.agent.put(`/admin/coupons/${ADMIN_CODE}`).send({ ...base, value: 15 }).expect(200)).body;
    expect(kept).toMatchObject({ value: 15, maxUses: 5, perUserLimit: 1 });
    const cleared = (await admin.agent.put(`/admin/coupons/${ADMIN_CODE}`).send({ ...base, maxUses: null, perUserLimit: null }).expect(200)).body;
    expect(cleared.maxUses).toBeUndefined();
    expect(cleared.perUserLimit).toBeUndefined();
    await admin.agent.put(`/admin/coupons/${ADMIN_CODE}`).send({ ...base, maxUses: 0 }).expect(400);
    await admin.agent.put(`/admin/coupons/${ADMIN_CODE}`).send({ ...base, perUserLimit: 1.5 }).expect(400);
  });

  it('a coupon can be recorded only once per order (database constraint)', async () => {
    const red = await t.prisma.couponRedemption.findFirstOrThrow({ where: { coupon: { code: TWO_TOTAL }, orderId: { not: null } } });
    await expect(t.prisma.couponRedemption.create({ data: { couponId: red.couponId, orderId: red.orderId, amount: 1 } })).rejects.toMatchObject({ code: 'P2002' });
  });
});
