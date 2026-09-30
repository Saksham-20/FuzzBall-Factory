import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootApp, makeUser, type TestApp, type TestUser } from './helpers/e2e.js';

/**
 * Money around work orders that the happy path never sees: a customer tapping "pay" twice, a second payment for the
 * same deposit, a payment that lands after the work order was cancelled, and the admin's manual refund.
 * Payments run through the mock gateway (DB only), which uses the same refund path as live.
 */
describe('work-order payment edge cases (e2e)', () => {
  let t: TestApp;
  let app: INestApplication;
  let maya: TestUser;
  let other: TestUser;
  let admin: TestUser;
  let category: string;
  const created: string[] = [];

  const mockPay = (paymentId: string) => request(app.getHttpServer()).post(`/payments/mock/${paymentId}/confirm`).send({ ok: true });
  const adminPost = (wo: string, action: string, payload: object = {}) => admin.agent.post(`/admin/custom/${wo}/${action}`).send(payload);
  const get = async (wo: string) => (await maya.agent.get(`/custom/${wo}`).expect(200)).body;

  /** A work order at DEPOSIT_PENDING with an accepted ₹1,000 quote (deposit ₹500). */
  async function depositPending(): Promise<string> {
    const res = await maya.agent
      .post('/custom')
      .send({
        kind: 'NEW', category, title: 'Payment edge bear', description: 'A small crochet bear for testing the payment edge cases, about 15 cm, cream.',
        colours: ['Cream'], size: 'About 15 cm', quantity: 1, budgetMin: 800, budgetMax: 1200, neededBy: '', occasion: 'Test', personalization: '',
        references: [], country: 'IN', postalCode: '560038', phone: '98765 43210',
      })
      .expect(201);
    const wo = res.body.number as string;
    created.push(wo);
    const quoted = (await adminPost(wo, 'quote', { breakdown: [{ label: 'Materials', amount: 400 }, { label: 'Crochet time', amount: 600 }], timelineDays: 8, revisions: 1, scope: 'One piece as described.' }).expect(200)).body;
    await maya.agent.post(`/custom/${wo}/quotes/${quoted.quotes.at(-1).id as string}/accept`).expect(200);
    return wo;
  }

  beforeAll(async () => {
    t = await bootApp();
    app = t.app;
    category = (await t.prisma.category.findFirstOrThrow()).slug;
    [maya, other, admin] = [await makeUser(t, 'customer', 'maya'), await makeUser(t, 'customer', 'other'), await makeUser(t, 'admin', 'admin')];
  });

  afterAll(async () => {
    const ids = (await t.prisma.customRequest.findMany({ where: { number: { in: created } }, select: { id: true } })).map((r) => r.id);
    await t.prisma.refundJob.deleteMany({ where: { payment: { requestId: { in: ids } } } });
    await t.prisma.payment.deleteMany({ where: { requestId: { in: ids } } });
    await t.prisma.idempotencyKey.deleteMany({ where: { userId: { in: [maya.id, other.id, admin.id] } } });
    await t.prisma.customRequest.deleteMany({ where: { id: { in: ids } } });
    await t.prisma.auditLog.deleteMany({ where: { actorId: admin.id } });
    if ((await t.prisma.customRequest.count()) === 0) await t.prisma.counter.updateMany({ where: { key: 'work_order' }, data: { value: 0 } });
    await t.prisma.user.deleteMany({ where: { id: { in: [maya.id, other.id, admin.id] } } });
    await app.close();
  });

  it('tapping pay twice resumes the same payment instead of creating another', async () => {
    const wo = await depositPending();
    const first = (await maya.agent.post(`/custom/${wo}/pay-deposit`).expect(200)).body;
    const second = (await maya.agent.post(`/custom/${wo}/pay-deposit`).expect(200)).body;
    expect(second.paymentId).toBe(first.paymentId);
    expect(second.razorpayOrderId).toBe(first.razorpayOrderId);
    const wo2 = await depositPending();
    const other2 = (await maya.agent.post(`/custom/${wo2}/pay-deposit`).expect(200)).body;
    expect(other2.paymentId).not.toBe(first.paymentId); // different work order, different payment
  });

  it('a second deposit payment is refunded automatically and the customer is told', async () => {
    const wo = await depositPending();
    const first = (await maya.agent.post(`/custom/${wo}/pay-deposit`).expect(200)).body;
    const row = await t.prisma.payment.findUniqueOrThrow({ where: { id: first.paymentId } });
    // A second, separate payment for the same deposit (the case the resume above normally prevents).
    const dup = await t.prisma.payment.create({
      data: { purpose: 'DEPOSIT', amount: row.amount, requestId: row.requestId, quoteId: row.quoteId, razorpayOrderId: `order_mock_dup_${Date.now()}`, status: 'PENDING', method: 'RAZORPAY' },
    });
    await mockPay(first.paymentId).expect(200);
    expect((await get(wo)).status).toBe('IN_PROGRESS');
    await mockPay(dup.id).expect(200);

    expect(await t.prisma.payment.findUniqueOrThrow({ where: { id: first.paymentId } })).toMatchObject({ status: 'PAID', refundedAmount: 0 });
    expect(await t.prisma.payment.findUniqueOrThrow({ where: { id: dup.id } })).toMatchObject({ status: 'REFUNDED', refundedAmount: 500, refundReserved: 500 });
    expect((await get(wo)).status).toBe('IN_PROGRESS'); // the work order is untouched
    const messages = (await get(wo)).messages as { author: string; body: string }[];
    expect(messages.at(-1)).toMatchObject({ author: 'maker' });
    expect(messages.at(-1)!.body).toContain('second payment');
  });

  it('a payment that lands after the work order was cancelled is refunded, not swallowed', async () => {
    const wo = await depositPending();
    const pay = (await maya.agent.post(`/custom/${wo}/pay-deposit`).expect(200)).body;
    await t.prisma.customRequest.update({ where: { number: wo }, data: { status: 'CANCELLED' } });
    await mockPay(pay.paymentId).expect(200);
    expect(await t.prisma.payment.findUniqueOrThrow({ where: { id: pay.paymentId } })).toMatchObject({ status: 'REFUNDED', refundedAmount: 500 });
    expect((await get(wo)).status).toBe('CANCELLED');
    expect(((await get(wo)).messages as { body: string }[]).at(-1)!.body).toContain('cancelled');
  });

  describe('admin refund', () => {
    it('lists a work order’s payments and refunds a deposit by hand, partially then in full, with an audit trail', async () => {
      const wo = await depositPending();
      const pay = (await maya.agent.post(`/custom/${wo}/pay-deposit`).expect(200)).body;
      await mockPay(pay.paymentId).expect(200);

      const list = (await admin.agent.get(`/admin/payments?request=${wo}`).expect(200)).body;
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id: pay.paymentId, purpose: 'DEPOSIT', status: 'PAID', amount: 500, refundedAmount: 0, refundable: 500, refunds: [] });

      const part = (await admin.agent.post(`/admin/payments/${pay.paymentId}/refund`).send({ amount: 200, reason: 'Customer changed the size' }).expect(200)).body;
      expect(part).toEqual({ refunded: 200, pending: 0 });
      const after = (await admin.agent.get(`/admin/payments?request=${wo}`).expect(200)).body[0];
      expect(after).toMatchObject({ status: 'PAID', refundedAmount: 200, refundable: 300 });
      expect(after.refunds).toHaveLength(1);
      expect(after.refunds[0]).toMatchObject({ amount: 200, status: 'DONE' });

      await admin.agent.post(`/admin/payments/${pay.paymentId}/refund`).send({ amount: 400, reason: 'too much' }).expect(400);
      expect((await admin.agent.post(`/admin/payments/${pay.paymentId}/refund`).send({ reason: 'Refund the rest' }).expect(200)).body).toEqual({ refunded: 300, pending: 0 });
      expect(await t.prisma.payment.findUniqueOrThrow({ where: { id: pay.paymentId } })).toMatchObject({ status: 'REFUNDED', refundedAmount: 500 });
      await admin.agent.post(`/admin/payments/${pay.paymentId}/refund`).send({ reason: 'again' }).expect(409); // no longer captured

      const audits = await t.prisma.auditLog.findMany({ where: { actorId: admin.id, action: 'payment.refund', entityId: pay.paymentId } });
      expect(audits).toHaveLength(2);
    });

    it('is admin-only and validates its input', async () => {
      const wo = await depositPending();
      const pay = (await maya.agent.post(`/custom/${wo}/pay-deposit`).expect(200)).body;
      await mockPay(pay.paymentId).expect(200);
      await other.agent.post(`/admin/payments/${pay.paymentId}/refund`).send({ reason: 'sneaky' }).expect(403);
      await other.agent.get(`/admin/payments?request=${wo}`).expect(403);
      await request(app.getHttpServer()).post(`/admin/payments/${pay.paymentId}/refund`).send({ reason: 'anon' }).expect(401);
      await admin.agent.post(`/admin/payments/${pay.paymentId}/refund`).send({}).expect(400); // reason required
      await admin.agent.post(`/admin/payments/${pay.paymentId}/refund`).send({ reason: 'x', amount: 0 }).expect(400);
      await admin.agent.get('/admin/payments').expect(400); // must name an order or work order
      await admin.agent.post('/admin/payments/nope/refund').send({ reason: 'missing' }).expect(404);
      expect(await t.prisma.payment.findUniqueOrThrow({ where: { id: pay.paymentId } })).toMatchObject({ status: 'PAID', refundedAmount: 0 });
    });
  });
});
