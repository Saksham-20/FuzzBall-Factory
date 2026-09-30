import { makeProduct, cleanupCommerce } from './helpers/commerce.js';
import { bootApp, makeUser, type TestApp, type TestUser } from './helpers/e2e.js';

/** The raw-SQL integrity rules (migration 20260930140000): each one must actually refuse a bad row, not just exist. */
describe('database integrity constraints (e2e)', () => {
  const TAG = `cons${Date.now()}`;
  let t: TestApp;
  let user: TestUser;
  beforeAll(async () => {
    t = await bootApp();
    user = await makeUser(t, 'customer', `${TAG}-u`);
  });
  afterAll(async () => {
    await t.prisma.customRequest.deleteMany({ where: { userId: user.id } });
    await cleanupCommerce(t.prisma, { tags: [TAG], userIds: [user.id] });
    await t.app.close();
  });

  const refuses = (p: Promise<unknown>, rule: RegExp) => expect(p).rejects.toThrow(rule);

  it('stock can never go negative, even through a raw update', async () => {
    const fx = await makeProduct(t.prisma, TAG, { stock: 2 });
    await refuses(t.prisma.productVariant.update({ where: { id: fx.variantId }, data: { stock: { decrement: 3 } } }), /ProductVariant_stock_nonneg|check constraint/i);
    expect((await t.prisma.productVariant.findUniqueOrThrow({ where: { id: fx.variantId } })).stock).toBe(2);
  });

  it('a payment cannot be refunded (or reserve a refund) beyond what was paid, and must be positive', async () => {
    const pay = await t.prisma.payment.create({ data: { purpose: 'ORDER', amount: 500, status: 'PAID' } });
    try {
      await refuses(t.prisma.payment.update({ where: { id: pay.id }, data: { refundedAmount: 501 } }), /Payment_refunds_within_amount|check constraint/i);
      await refuses(t.prisma.payment.update({ where: { id: pay.id }, data: { refundReserved: 501 } }), /Payment_refunds_within_amount|check constraint/i);
      await refuses(t.prisma.payment.create({ data: { purpose: 'ORDER', amount: 0 } }), /Payment_amount_positive|check constraint/i);
      await t.prisma.payment.update({ where: { id: pay.id }, data: { refundedAmount: 500, refundReserved: 500 } }); // exactly the amount is fine
    } finally {
      await t.prisma.payment.delete({ where: { id: pay.id } });
    }
  });

  it('a review rating must be 1 to 5', async () => {
    const fx = await makeProduct(t.prisma, TAG, {});
    for (const rating of [0, 6, -1]) await refuses(t.prisma.review.create({ data: { productId: fx.productId, author: 'X', rating, body: 'Nope nope', status: 'PENDING' } }), /Review_rating_range|check constraint/i);
  });

  it('a percent coupon cannot exceed 100 and limits cannot be nonsense', async () => {
    const code = `${TAG}-CPN`.toUpperCase();
    await refuses(t.prisma.coupon.create({ data: { code, kind: 'PERCENT', value: 150 } }), /Coupon_values_sane|check constraint/i);
    await refuses(t.prisma.coupon.create({ data: { code, kind: 'FLAT', value: 100, perUserLimit: 0 } }), /Coupon_values_sane|check constraint/i);
    await t.prisma.coupon.create({ data: { code, kind: 'FLAT', value: 500 } }); // a flat discount over 100 is fine
    await t.prisma.coupon.delete({ where: { code } });
  });

  describe('work orders', () => {
    const request = (over: Record<string, unknown> = {}) =>
      t.prisma.customRequest.create({
        data: { number: `WO-${TAG}-${Math.random().toString(36).slice(2, 7)}`, userId: user.id, customerName: 'X', customerPhone: '+919811122233', category: 'toys', title: 'Bear', description: 'x'.repeat(40), colours: ['Cream'], budgetMin: 500, budgetMax: 900, ...over } as never,
      });
    const quote = (requestId: string, status: 'SENT' | 'ACCEPTED' | 'DECLINED', over: Record<string, unknown> = {}) =>
      t.prisma.quote.create({ data: { requestId, price: 800, timelineDays: 5, scope: 'One piece', validUntil: new Date(Date.now() + 86_400_000), status, ...over } });

    it('budget must be a sensible range and quantity positive', async () => {
      await refuses(request({ budgetMin: 900, budgetMax: 500 }), /CustomRequest_quantity_budget|check constraint/i);
      await refuses(request({ quantity: 0 }), /CustomRequest_quantity_budget|check constraint/i);
    });

    it('a work order can have any number of quotes but only one accepted', async () => {
      const wo = await request();
      await quote(wo.id, 'DECLINED');
      await quote(wo.id, 'DECLINED');
      await quote(wo.id, 'ACCEPTED');
      await refuses(quote(wo.id, 'ACCEPTED'), /Quote_one_accepted_per_request|unique constraint/i);
      const other = await request();
      await quote(other.id, 'ACCEPTED'); // a different work order is independent
      await refuses(quote(other.id, 'SENT', { price: 0 }), /Quote_price_positive|check constraint/i);
      await refuses(quote(other.id, 'SENT', { depositPct: 101 }), /Quote_price_positive|check constraint/i);
    });
  });
});
