import { createHmac } from 'node:crypto';
import request from 'supertest';
import { PaymentsService } from '../src/payments/payments.service.js';
import type { RazorpayGateway } from '../src/payments/razorpay.gateway.js';
import { bootCommerce, cleanupCommerce, guest, makeProduct, MOCK_PAYMENT_ENV, orderBody, stockOf, type CommerceApp, type Fixture } from './helpers/commerce.js';

/**
 * Razorpay in LIVE mode (keys configured) with the SDK wrapper replaced by a fake: signature verification, the
 * webhook (HMAC over the raw body, event-id dedupe, idempotent double delivery, every event type), refunds, and
 * the guarantee that the mock-confirm endpoint does not exist when keys are set or in production.
 */
const TAG = `pay${Date.now()}`;
const KEY_ID = 'rzp_test_e2e';
const KEY_SECRET = 'e2e_key_secret';
const WEBHOOK_SECRET = 'e2e_webhook_secret';
const sign = (body: string | Buffer, secret = WEBHOOK_SECRET) => createHmac('sha256', secret).update(body).digest('hex');

function fakeGateway() {
  const calls = { orders: [] as { amountPaise: number; receipt: string }[], refunds: [] as { paymentId: string; amountPaise: number }[] };
  let n = 0;
  let failRefunds = false;
  const gateway: RazorpayGateway = {
    createOrder: (args) => {
      calls.orders.push({ amountPaise: args.amountPaise, receipt: args.receipt });
      return Promise.resolve({ id: `order_${TAG}_${++n}` });
    },
    refund: (paymentId, args) => {
      if (failRefunds) return Promise.reject(new Error('Razorpay is down'));
      calls.refunds.push({ paymentId, amountPaise: args.amountPaise });
      return Promise.resolve({ id: `rfnd_${n}`, status: 'processed' });
    },
  };
  return { gateway, calls, failRefunds: (v: boolean) => (failRefunds = v) };
}

describe('Razorpay live mode (e2e, fake gateway)', () => {
  let t: CommerceApp;
  let fx: Fixture;
  let evt = 0;
  const g = fakeGateway();
  const http = () => guest(t);

  const placeOnline = async (name: string, qty = 1, o: Record<string, unknown> = {}) => {
    const res = await http().post('/orders').send(orderBody(`${TAG}-${name}`, [{ productId: fx.productId, variantId: fx.variantId, qty }], o)).expect(201);
    return res.body as { number: string; total: number; payment: { paymentId: string; razorpayOrderId: string; keyId: string; amountPaise: number; mock: boolean } };
  };
  const paymentSig = (orderId: string, paymentId: string) => createHmac('sha256', KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex');
  const verify = (orderId: string, paymentId: string, signature = paymentSig(orderId, paymentId)) =>
    http().post('/payments/razorpay/verify').send({ razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature });

  const captured = (rzpOrderId: string, rzpPaymentId: string, amountPaise: number, event = 'payment.captured') => ({
    event,
    payload: { payment: { entity: { id: rzpPaymentId, order_id: rzpOrderId, amount: amountPaise, currency: 'INR', status: 'captured', email: 'secret@example.com', contact: '+919811122233' } }, order: { entity: { id: rzpOrderId } } },
  });
  const webhook = (body: object | string, opts: { eventId?: string | null; signature?: string | null } = {}) => {
    const raw = typeof body === 'string' ? body : JSON.stringify(body);
    const eventId = opts.eventId === undefined ? `e2e-${TAG}-evt-${++evt}` : opts.eventId;
    let r = http().post('/payments/razorpay/webhook').set('Content-Type', 'application/json');
    if (eventId) r = r.set('X-Razorpay-Event-Id', eventId);
    const signature = opts.signature === undefined ? sign(raw) : opts.signature;
    if (signature) r = r.set('X-Razorpay-Signature', signature);
    return { eventId, res: r.send(raw) };
  };
  const orderRow = (number: string) => t.prisma.order.findUniqueOrThrow({ where: { number }, include: { events: { orderBy: { at: 'asc' } } } });
  const paymentRow = (id: string) => t.prisma.payment.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    t = await bootCommerce({ env: { RAZORPAY_KEY_ID: KEY_ID, RAZORPAY_KEY_SECRET: KEY_SECRET, RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET }, gateway: g.gateway });
    fx = await makeProduct(t.prisma, TAG, { price: 500, stock: 100 });
  });

  afterAll(async () => {
    await cleanupCommerce(t.prisma, { tags: [TAG] });
    t.restoreEnv();
    await t.app.close();
  });

  it('is live: creates the Razorpay order in paise with the order number as receipt, and never offers mock', async () => {
    expect(t.app.get(PaymentsService).mode).toBe('live');
    const o = await placeOnline('create', 2);
    expect(o.total).toBe(1000); // 2 x 500, free shipping
    expect(o.payment).toMatchObject({ mock: false, keyId: KEY_ID, amountPaise: 100_000, razorpayOrderId: expect.stringContaining(`order_${TAG}`) });
    expect(g.calls.orders.at(-1)).toEqual({ amountPaise: 100_000, receipt: o.number });
    const row = await paymentRow(o.payment.paymentId);
    expect(row).toMatchObject({ purpose: 'ORDER', amount: 1000, status: 'PENDING', method: 'RAZORPAY' });
  });

  it('the mock-confirm endpoint answers 404 when keys are configured', async () => {
    const o = await placeOnline('nomock');
    const res = await http().post(`/payments/mock/${o.payment.paymentId}/confirm`).send({ ok: true }).expect(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect((await orderRow(o.number)).status).toBe('PENDING_PAYMENT');
  });

  describe('POST /payments/razorpay/verify', () => {
    it('rejects a bad signature (400) without changing anything, accepts the right one, and is replay-safe', async () => {
      const o = await placeOnline('verify');
      const bad = await verify(o.payment.razorpayOrderId, 'pay_verify_1', 'a'.repeat(64)).expect(400);
      expect(bad.body).toMatchObject({ code: 'PAYMENT_FAILED' });
      await verify(o.payment.razorpayOrderId, 'pay_verify_1', 'nothex').expect(400);
      expect((await paymentRow(o.payment.paymentId)).status).toBe('PENDING');

      // A signature for a DIFFERENT payment id doesn't validate this one.
      await verify(o.payment.razorpayOrderId, 'pay_other', paymentSig(o.payment.razorpayOrderId, 'pay_verify_1')).expect(400);

      const ok = await verify(o.payment.razorpayOrderId, 'pay_verify_1').expect(200);
      expect(ok.body).toMatchObject({ status: 'PAID', purpose: 'ORDER', orderNumber: o.number, alreadyProcessed: false });
      const row = await paymentRow(o.payment.paymentId);
      expect(row).toMatchObject({ status: 'PAID', razorpayPaymentId: 'pay_verify_1', razorpaySignature: expect.any(String) });
      expect(row.paidAt).toBeTruthy();
      const order = await orderRow(o.number);
      expect(order).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID' });
      expect(order.events.map((e) => e.status)).toEqual(['PENDING_PAYMENT', 'PLACED', 'CONFIRMED']);

      const replay = await verify(o.payment.razorpayOrderId, 'pay_verify_1').expect(200);
      expect(replay.body.alreadyProcessed).toBe(true);
      expect((await orderRow(o.number)).events).toHaveLength(3);
      expect(t.sent.filter((s) => s.event === 'order.confirmed' && s.payload.orderNumber === o.number)).toHaveLength(1);
    });

    it('unknown razorpay order ids are 404; malformed bodies are 400; Idempotency-Key replays', async () => {
      await verify('order_does_not_exist', 'pay_x').expect(404);
      await http().post('/payments/razorpay/verify').send({ razorpay_order_id: 'x' }).expect(400);
      const o = await placeOnline('verify-key');
      const key = `e2e-${TAG}-verify-key`;
      const send = () => http().post('/payments/razorpay/verify').set('Idempotency-Key', key).send({ razorpay_order_id: o.payment.razorpayOrderId, razorpay_payment_id: 'pay_vk', razorpay_signature: paymentSig(o.payment.razorpayOrderId, 'pay_vk') });
      const first = await send().expect(200);
      const second = await send().expect(200);
      expect(second.body).toEqual(first.body);
    });
  });

  describe('POST /payments/razorpay/webhook', () => {
    it('rejects missing or wrong signatures (400) and processes nothing', async () => {
      const o = await placeOnline('wh-badsig');
      const body = captured(o.payment.razorpayOrderId, 'pay_badsig', o.payment.amountPaise);
      await webhook(body, { signature: 'f'.repeat(64) }).res.expect(400);
      await webhook(body, { signature: null }).res.expect(400);
      await webhook(body, { signature: sign(JSON.stringify(body), 'wrong-secret') }).res.expect(400);
      await webhook('not json', { signature: sign('not json') }).res.expect(400);
      expect((await paymentRow(o.payment.paymentId)).status).toBe('PENDING');
      expect(await t.prisma.webhookEvent.count({ where: { eventId: { startsWith: `e2e-${TAG}` }, payload: { path: ['payload', 'payment', 'entity', 'id'], equals: 'pay_badsig' } } })).toBe(0);
    });

    it('payment.captured marks PAID; the identical delivery again is a duplicate; a second event for the same payment is a no-op', async () => {
      const o = await placeOnline('wh-captured');
      const body = captured(o.payment.razorpayOrderId, 'pay_wh_1', o.payment.amountPaise);
      const first = webhook(body);
      await first.res.expect(200).expect({ status: 'processed' });
      const order = await orderRow(o.number);
      expect(order).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID' });
      expect(order.events.map((e) => e.status)).toEqual(['PENDING_PAYMENT', 'PLACED', 'CONFIRMED']);
      expect(await paymentRow(o.payment.paymentId)).toMatchObject({ status: 'PAID', razorpayPaymentId: 'pay_wh_1' });

      // Razorpay re-delivers the same event id: acknowledged, not processed again.
      await webhook(body, { eventId: first.eventId }).res.expect(200).expect({ status: 'duplicate' });
      // Same payment announced by another event (order.paid, new id): handlers must not run twice.
      await webhook(captured(o.payment.razorpayOrderId, 'pay_wh_1', o.payment.amountPaise, 'order.paid')).res.expect(200);
      // ...and after the checkout callback also arrived.
      const late = await verify(o.payment.razorpayOrderId, 'pay_wh_1').expect(200);
      expect(late.body.alreadyProcessed).toBe(true);

      expect((await orderRow(o.number)).events).toHaveLength(3);
      expect(t.sent.filter((s) => s.event === 'order.confirmed' && s.payload.orderNumber === o.number)).toHaveLength(1);
      const stored = await t.prisma.webhookEvent.findUniqueOrThrow({ where: { eventId: first.eventId! } });
      expect(stored).toMatchObject({ provider: 'razorpay', type: 'payment.captured' });
      expect(stored.processedAt).toBeTruthy();
      expect(JSON.stringify(stored.payload)).not.toContain('secret@example.com'); // PII redacted before storing
      expect(JSON.stringify(stored.payload)).not.toContain('+919811122233');
    });

    it('concurrent duplicate deliveries still confirm exactly once', async () => {
      const o = await placeOnline('wh-race');
      const body = captured(o.payment.razorpayOrderId, 'pay_wh_race', o.payment.amountPaise);
      const eventId = `e2e-${TAG}-race`;
      const results = await Promise.all([1, 2, 3, 4].map(() => webhook(body, { eventId }).res));
      for (const r of results) expect(r.status).toBe(200);
      expect((await orderRow(o.number)).events.map((e) => e.status)).toEqual(['PENDING_PAYMENT', 'PLACED', 'CONFIRMED']);
      expect(await t.prisma.webhookEvent.count({ where: { eventId } })).toBe(1);
    });

    it('an amount that does not match the payment is refused (500 so Razorpay retries) and recorded, never marked paid', async () => {
      const o = await placeOnline('wh-amount');
      const w = webhook(captured(o.payment.razorpayOrderId, 'pay_wh_amount', 100));
      await w.res.expect(500);
      expect((await paymentRow(o.payment.paymentId)).status).toBe('PENDING');
      expect((await orderRow(o.number)).status).toBe('PENDING_PAYMENT');
      const stored = await t.prisma.webhookEvent.findUniqueOrThrow({ where: { eventId: w.eventId! } });
      expect(stored.processedAt).toBeNull();
      expect(stored.error).toContain('Amount mismatch');
    });

    it('payment.failed marks the attempt failed but can never downgrade a paid payment', async () => {
      const o = await placeOnline('wh-failed');
      const failed = { event: 'payment.failed', payload: { payment: { entity: { id: 'pay_f1', order_id: o.payment.razorpayOrderId, error_description: 'Card declined' } } } };
      await webhook(failed).res.expect(200);
      expect(await paymentRow(o.payment.paymentId)).toMatchObject({ status: 'FAILED', failureReason: 'Card declined' });
      expect((await orderRow(o.number)).paymentStatus).toBe('FAILED');

      // Razorpay lets the customer retry on the same order: a later capture still pays it.
      await webhook(captured(o.payment.razorpayOrderId, 'pay_f2', o.payment.amountPaise)).res.expect(200);
      expect(await orderRow(o.number)).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID' });
      await webhook({ ...failed, payload: { payment: { entity: { id: 'pay_f3', order_id: o.payment.razorpayOrderId } } } }).res.expect(200);
      expect(await paymentRow(o.payment.paymentId)).toMatchObject({ status: 'PAID' });
      expect((await orderRow(o.number)).paymentStatus).toBe('PAID');
    });

    it('ignores events for orders that are not ours and event types it does not handle', async () => {
      await webhook(captured('order_someone_elses', 'pay_zzz', 100)).res.expect(200).expect({ status: 'ignored' });
      await webhook({ event: 'subscription.charged', payload: {} }).res.expect(200).expect({ status: 'ignored' });
    });

    it('falls back to a body hash when Razorpay sends no event id, so exact redeliveries still dedupe', async () => {
      const body = { event: 'payment.authorized', payload: { unique: `${TAG}-nohdr` } };
      await webhook(body, { eventId: null }).res.expect(200).expect({ status: 'ignored' });
      await webhook(body, { eventId: null }).res.expect(200).expect({ status: 'duplicate' });
      await t.prisma.webhookEvent.deleteMany({ where: { type: 'payment.authorized', eventId: { startsWith: 'sha256:' } } });
    });

    it('refund.processed from the Razorpay dashboard is mirrored onto the payment and the order', async () => {
      const o = await placeOnline('wh-refund');
      await webhook(captured(o.payment.razorpayOrderId, 'pay_wh_rf', o.payment.amountPaise)).res.expect(200);
      await webhook({ event: 'refund.processed', payload: { refund: { entity: { id: 'rfnd_dash', payment_id: 'pay_wh_rf', amount: o.payment.amountPaise, status: 'processed' } } } }).res.expect(200);
      expect(await paymentRow(o.payment.paymentId)).toMatchObject({ status: 'REFUNDED', refundedAmount: o.total });
      expect((await orderRow(o.number)).paymentStatus).toBe('REFUNDED');
      await webhook({ event: 'refund.failed', payload: { refund: { entity: { id: 'rfnd_x', payment_id: 'pay_wh_rf' } } } }).res.expect(200);
    });
  });

  describe('refunds', () => {
    it('cancelling a paid order sends exactly one Razorpay refund in paise and marks it REFUNDED; a second cancel refunds nothing', async () => {
      const stock0 = await stockOf(t.prisma, fx.variantId);
      const o = await placeOnline('refund', 3);
      await verify(o.payment.razorpayOrderId, 'pay_rf_1').expect(200);
      const before = g.calls.refunds.length;
      const res = await http().post(`/orders/${o.number}/cancel`).send({}).expect(404); // other browser
      expect(res.body.code).toBe('NOT_FOUND');
      const agent = guest(t);
      await agent.post('/orders').send(orderBody(`${TAG}-refund2`, [{ productId: fx.productId, variantId: fx.variantId, qty: 2 }])).expect(201).then(async (placed) => {
        const p = placed.body as typeof o;
        await verify(p.payment.razorpayOrderId, 'pay_rf_2').expect(200);
        const cancelled = await agent.post(`/orders/${p.number}/cancel`).send({ reason: 'Nope' }).expect(200);
        expect(cancelled.body).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' });
        expect(g.calls.refunds.slice(before)).toEqual([{ paymentId: 'pay_rf_2', amountPaise: p.total * 100 }]);
        expect(await paymentRow(p.payment.paymentId)).toMatchObject({ status: 'REFUNDED', refundedAmount: p.total });
        await agent.post(`/orders/${p.number}/cancel`).send({}).expect(409);
        expect(g.calls.refunds.slice(before)).toHaveLength(1);
      });
      expect(await stockOf(t.prisma, fx.variantId)).toBe(stock0 - 3); // the first order (3 pieces) still holds its stock
    });

    it('if Razorpay refuses the refund the cancellation still succeeds and the order says a manual refund is needed', async () => {
      const agent = guest(t);
      const placed = (await agent.post('/orders').send(orderBody(`${TAG}-rffail`, [{ productId: fx.productId, variantId: fx.variantId }])).expect(201)).body as { number: string; total: number; payment: { paymentId: string; razorpayOrderId: string } };
      await verify(placed.payment.razorpayOrderId, 'pay_rf_fail').expect(200);
      g.failRefunds(true);
      try {
        const res = await agent.post(`/orders/${placed.number}/cancel`).send({}).expect(200);
        expect(res.body.status).toBe('CANCELLED');
        expect(res.body.paymentStatus).toBe('PAID'); // money not returned yet
        expect(res.body.events.at(-1).note).toContain("couldn't send the refund automatically");
        expect(await paymentRow(placed.payment.paymentId)).toMatchObject({ status: 'PAID', refundedAmount: 0 });
      } finally {
        g.failRefunds(false);
      }
    });

    it('a payment that arrives AFTER the order was cancelled is refunded automatically', async () => {
      const agent = guest(t);
      const placed = (await agent.post('/orders').send(orderBody(`${TAG}-late`, [{ productId: fx.productId, variantId: fx.variantId }])).expect(201)).body as { number: string; total: number; payment: { paymentId: string; razorpayOrderId: string; amountPaise: number } };
      await agent.post(`/orders/${placed.number}/cancel`).send({}).expect(200);
      const before = g.calls.refunds.length;
      await webhook(captured(placed.payment.razorpayOrderId, 'pay_late', placed.payment.amountPaise)).res.expect(200);
      expect(g.calls.refunds.slice(before)).toEqual([{ paymentId: 'pay_late', amountPaise: placed.payment.amountPaise }]);
      expect(await paymentRow(placed.payment.paymentId)).toMatchObject({ status: 'REFUNDED' });
      const order = await orderRow(placed.number);
      expect(order).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' });
      expect(order.events.some((e) => e.note?.includes('after this order was cancelled'))).toBe(true);
    });

    it('a second payment for an already-paid order is refunded, and the order stays paid', async () => {
      const agent = guest(t);
      const placed = (await agent.post('/orders').send(orderBody(`${TAG}-dup`, [{ productId: fx.productId, variantId: fx.variantId }])).expect(201)).body as { number: string; payment: { paymentId: string; razorpayOrderId: string; amountPaise: number } };
      // Customer retried: a second Razorpay order exists for the same order (only possible while it was still unpaid).
      const retry = (await agent.post(`/orders/${placed.number}/pay`).expect(200)).body as { paymentId: string; razorpayOrderId: string; amountPaise: number };
      await webhook(captured(placed.payment.razorpayOrderId, 'pay_dup_1', placed.payment.amountPaise)).res.expect(200);
      const before = g.calls.refunds.length;
      await webhook(captured(retry.razorpayOrderId, 'pay_dup_2', retry.amountPaise)).res.expect(200);
      expect(g.calls.refunds.slice(before)).toEqual([{ paymentId: 'pay_dup_2', amountPaise: retry.amountPaise }]);
      expect(await orderRow(placed.number)).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID' });
      expect(await paymentRow(placed.payment.paymentId)).toMatchObject({ status: 'PAID' });
      expect(await paymentRow(retry.paymentId)).toMatchObject({ status: 'REFUNDED' });
    });
  });
});

describe('payments in production without keys (e2e)', () => {
  let t: CommerceApp;
  const TAG2 = `${TAG}prod`;
  let fx: Fixture;

  beforeAll(async () => {
    t = await bootCommerce({ env: MOCK_PAYMENT_ENV, config: { NODE_ENV: 'production' } });
    fx = await makeProduct(t.prisma, TAG2, { stock: 3 });
  });
  afterAll(async () => {
    await cleanupCommerce(t.prisma, { tags: [TAG2] });
    t.restoreEnv();
    await t.app.close();
  });

  it('never runs mock payments: online orders are refused (503, stock released) and mock confirm is 404', async () => {
    expect(t.app.get(PaymentsService).mode).toBe('disabled');
    const res = await request(t.app.getHttpServer()).post('/orders').send(orderBody(`${TAG2}-a`, [{ productId: fx.productId, variantId: fx.variantId }])).expect(503);
    expect(res.body.code).toBe('PAYMENT_FAILED');
    expect(await stockOf(t.prisma, fx.variantId)).toBe(3);
    await request(t.app.getHttpServer()).post('/payments/mock/anything/confirm').send({ ok: true }).expect(404);
    // COD needs no gateway and still works.
    await request(t.app.getHttpServer()).post('/orders').send(orderBody(`${TAG2}-b`, [{ productId: fx.productId, variantId: fx.variantId }], { paymentMethod: 'COD' })).expect(201);
  });
});
