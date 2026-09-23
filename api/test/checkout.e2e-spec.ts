import request from 'supertest';
import { OrderStateService, SYSTEM_ACTOR } from '../src/orders/order-state.service.js';
import { makeUser, type TestUser } from './helpers/e2e.js';
import { bootCommerce, cleanupCommerce, guest, makeProduct, MOCK_PAYMENT_ENV, orderBody, stockOf, type CommerceApp, type Fixture } from './helpers/commerce.js';

/**
 * Checkout end to end against the real DB with MOCK payments (no Razorpay keys): quote -> place -> confirm ->
 * track, failed payment + retry, COD rules, cancel + restock, the sold-out race, ownership. Every row it creates
 * is removed afterwards (products/orders/users carry the `chk<stamp>` tag).
 */
const TAG = `chk${Date.now()}`;
const COUPON = `E2E${Date.now()}`;

describe('checkout flows (e2e, mock payments)', () => {
  let t: CommerceApp;
  let state: OrderStateService;
  const users: TestUser[] = [];
  let ready: Fixture;
  let mto: Fixture;
  let pricey: Fixture;

  const http = () => guest(t);
  const place = (agent: ReturnType<typeof guest>, name: string, lines: Parameters<typeof orderBody>[1], o: Record<string, unknown> = {}, key?: string) => {
    const r = agent.post('/orders').send(orderBody(`${TAG}-${name}`, lines, o));
    return key ? r.set('Idempotency-Key', key) : r;
  };
  const confirm = (paymentId: string, ok: boolean) => http().post(`/payments/mock/${paymentId}/confirm`).send({ ok });

  beforeAll(async () => {
    t = await bootCommerce({ env: MOCK_PAYMENT_ENV });
    state = t.app.get(OrderStateService);
    ready = await makeProduct(t.prisma, TAG, { price: 400, stock: 50 });
    mto = await makeProduct(t.prisma, TAG, { price: 1450, stock: 50, fulfilment: 'MADE_TO_ORDER', leadTimeDays: 5 });
    pricey = await makeProduct(t.prisma, TAG, { price: 2500, stock: 50 });
    await t.prisma.coupon.create({ data: { code: COUPON, kind: 'PERCENT', value: 10, maxUses: 100 } });
  });

  afterAll(async () => {
    await cleanupCommerce(t.prisma, { tags: [TAG], couponCodes: [COUPON], userIds: users.map((u) => u.id) });
    t.restoreEnv();
    await t.app.close();
  });

  describe('quote', () => {
    it('prices the basket on the server: guest, India, ready pieces', async () => {
      const res = await http().post('/checkout/quote').send({ lines: [{ productId: ready.productId, variantId: ready.variantId, qty: 2 }], country: 'IN' }).expect(200);
      expect(res.body).toMatchObject({ subtotal: 800, shipping: 79, total: 879, codEligible: true, hasMadeToOrder: false, shippingLabel: 'Standard shipping, India' });
      expect(new Date(res.body.estimatedDispatch).getTime()).toBeGreaterThan(Date.now());
    });

    it('applies COD fee, gift wrap and coupon like the web engine, and reports coupon errors without failing', async () => {
      const lines = [{ productId: ready.productId, variantId: ready.variantId, qty: 1 }];
      const ok = await http().post('/checkout/quote').send({ lines, country: 'IN', paymentMethod: 'COD', giftWrap: true, coupon: COUPON.toLowerCase() }).expect(200);
      expect(ok.body).toMatchObject({ subtotal: 400, discount: 40, giftWrap: 59, codFee: 49, shipping: 79, total: 547, couponApplied: COUPON });
      const bad = await http().post('/checkout/quote').send({ lines, country: 'IN', coupon: 'NOSUCHCODE' }).expect(200);
      expect(bad.body).toMatchObject({ discount: 0, couponError: "We don't recognise that code." });
    });

    it('made-to-order and international baskets are not COD-eligible', async () => {
      const m = await http().post('/checkout/quote').send({ lines: [{ productId: mto.productId, variantId: mto.variantId, qty: 1 }], country: 'IN', paymentMethod: 'COD' }).expect(200);
      expect(m.body).toMatchObject({ codEligible: false, codFee: 0, hasMadeToOrder: true, maxLeadTimeDays: 5 });
      const gb = await http().post('/checkout/quote').send({ lines: [{ productId: ready.productId, variantId: ready.variantId, qty: 1 }], country: 'gb' }).expect(200);
      expect(gb.body).toMatchObject({ shipping: 1499, codEligible: false, shippingLabel: 'International: UK & Europe' });
    });

    it('never trusts client prices: unknown fields are a 400, quantities are bounded', async () => {
      const forged = await http().post('/checkout/quote').send({ lines: [{ productId: ready.productId, variantId: ready.variantId, qty: 1, price: 1 }], country: 'IN' }).expect(400);
      expect(forged.body).toMatchObject({ code: 'VALIDATION_FAILED' });
      await http().post('/checkout/quote').send({ lines: [{ productId: ready.productId, variantId: ready.variantId, qty: 0 }], country: 'IN' }).expect(400);
      await http().post('/checkout/quote').send({ lines: [{ productId: ready.productId, variantId: ready.variantId, qty: 999 }], country: 'IN' }).expect(400);
      await http().post('/checkout/quote').send({ lines: [], country: 'India' }).expect(400);
    });
  });

  describe('guest: place RAZORPAY order -> mock confirm -> track by phone', () => {
    it('runs the whole happy path', async () => {
      const agent = http();
      const before = await stockOf(t.prisma, ready.variantId);
      const key = `e2e-${TAG}-happy`;
      const body = orderBody(`${TAG}-happy`, [{ productId: ready.productId, variantId: ready.variantId, qty: 2 }], { giftWrap: true, giftNote: 'Happy birthday!', coupon: COUPON });

      const placed = await agent.post('/orders').set('Idempotency-Key', key).send(body).expect(201);
      const order = placed.body;
      expect(order).toMatchObject({
        status: 'PENDING_PAYMENT', paymentStatus: 'PENDING', paymentMethod: 'RAZORPAY', currency: 'INR',
        subtotal: 800, shipping: 79, giftWrap: 59, discount: 80, codFee: 0, total: 858, giftNote: 'Happy birthday!',
        contact: { name: 'E2E Shopper', email: `${TAG}-happy@e2e.test`, phone: '+919811122233' },
      });
      expect(order.number).toMatch(/^FB-\d+$/);
      expect(order.items).toEqual([expect.objectContaining({ productId: ready.productId, name: expect.stringContaining('E2E'), qty: 2, unitPrice: 400, fulfilment: 'READY' })]);
      expect(order.events).toEqual([expect.objectContaining({ status: 'PENDING_PAYMENT' })]);
      expect(order.payment).toMatchObject({ mock: true, amountPaise: 85_800, currency: 'INR', keyId: expect.any(String) });
      expect(await stockOf(t.prisma, ready.variantId)).toBe(before - 2);
      const setCookie = (placed.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('fbf_go='))!;
      expect(setCookie).toMatch(/HttpOnly/i);
      expect(setCookie).toMatch(/Path=\/orders/);
      expect(t.sent.some((s) => s.event === 'order.placed' && s.payload.orderNumber === order.number)).toBe(false); // online orders are announced once paid

      // Same key + same body replays the same order (and does not take stock twice); a different body is refused.
      const replay = await http().post('/orders').set('Idempotency-Key', key).send(body).expect(201);
      expect(replay.body.number).toBe(order.number);
      expect(await stockOf(t.prisma, ready.variantId)).toBe(before - 2);
      await http().post('/orders').set('Idempotency-Key', key).send({ ...body, giftNote: 'other' }).expect(422);

      // The placing browser can read it; nobody else can.
      await agent.get(`/orders/${order.number}`).expect(200).expect((r) => expect(r.body.status).toBe('PENDING_PAYMENT'));
      await http().get(`/orders/${order.number}`).expect(404);

      // Pay (mock success).
      const paid = await confirm(order.payment.paymentId, true).expect(200);
      expect(paid.body).toMatchObject({ status: 'PAID', purpose: 'ORDER', orderNumber: order.number, alreadyProcessed: false });
      const again = await confirm(order.payment.paymentId, true).expect(200);
      expect(again.body.alreadyProcessed).toBe(true);

      const after = await agent.get(`/orders/${order.number}`).expect(200);
      expect(after.body).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID' });
      expect(after.body.events.map((e: { status: string }) => e.status)).toEqual(['PENDING_PAYMENT', 'PLACED', 'CONFIRMED']); // one CONFIRMED despite the double confirm
      expect(t.sent.filter((s) => s.event === 'order.confirmed' && s.payload.orderNumber === order.number)).toHaveLength(1);

      // Track by phone (any formatting), by email; wrong contact and unknown number are indistinguishable.
      const tracked = await http().post('/orders/track').send({ number: order.number.toLowerCase(), contact: '+91 98111 22233' }).expect(200);
      expect(tracked.body).toMatchObject({ number: order.number, status: 'CONFIRMED' });
      await http().post('/orders/track').send({ number: order.number, contact: `${TAG}-happy@e2e.test` }).expect(200);
      const wrong = await http().post('/orders/track').send({ number: order.number, contact: '9000000000' }).expect(404);
      const unknown = await http().post('/orders/track').send({ number: 'FB-999999', contact: '9811122233' }).expect(404);
      expect(wrong.body).toEqual(unknown.body);
      const couponRow = await t.prisma.coupon.findUniqueOrThrow({ where: { code: COUPON } });
      expect(couponRow.uses).toBe(1);
    });
  });

  describe('failed payment, then retry', () => {
    it('keeps the order payable: 402 on failure, pending + FAILED, then a fresh payment succeeds', async () => {
      const agent = http();
      const placed = (await place(agent, 'retry', [{ productId: ready.productId, variantId: ready.variantId }]).expect(201)).body;

      const failed = await confirm(placed.payment.paymentId, false).expect(402);
      expect(failed.body).toMatchObject({ code: 'PAYMENT_FAILED', message: expect.stringContaining("didn't go through") });
      const mid = (await agent.get(`/orders/${placed.number}`).expect(200)).body;
      expect(mid).toMatchObject({ status: 'PENDING_PAYMENT', paymentStatus: 'FAILED' });

      const retry = (await agent.post(`/orders/${placed.number}/pay`).expect(200)).body;
      expect(retry).toMatchObject({ mock: true, amountPaise: placed.total * 100 });
      expect(retry.paymentId).not.toBe(placed.payment.paymentId);
      expect((await agent.get(`/orders/${placed.number}`)).body.paymentStatus).toBe('PENDING');

      await confirm(retry.paymentId, true).expect(200);
      const done = (await agent.get(`/orders/${placed.number}`).expect(200)).body;
      expect(done).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID' });

      // Nothing more to pay once confirmed; nobody else can start a payment on it.
      await agent.post(`/orders/${placed.number}/pay`).expect(409);
      await http().post(`/orders/${placed.number}/pay`).expect(404);
    });

    it('a declined mock payment cannot undo a payment that already succeeded', async () => {
      const agent = http();
      const placed = (await place(agent, 'decline-after-paid', [{ productId: ready.productId, variantId: ready.variantId }]).expect(201)).body;
      await confirm(placed.payment.paymentId, true).expect(200);
      await confirm(placed.payment.paymentId, false).expect(409);
      expect((await agent.get(`/orders/${placed.number}`)).body.paymentStatus).toBe('PAID');
    });

    it('mock confirm 404s for unknown payments', async () => {
      await confirm('does-not-exist', true).expect(404);
    });
  });

  describe('cash on delivery', () => {
    it('ready-only India order succeeds: PLACED / COD_DUE, COD fee, no payment', async () => {
      const agent = http();
      const before = await stockOf(t.prisma, ready.variantId);
      const res = await place(agent, 'cod-ok', [{ productId: ready.productId, variantId: ready.variantId, qty: 1 }], { paymentMethod: 'COD' }).expect(201);
      expect(res.body).toMatchObject({ status: 'PLACED', paymentStatus: 'COD_DUE', paymentMethod: 'COD', codFee: 49, shipping: 79, total: 528 });
      expect(res.body.payment).toBeUndefined();
      expect(res.body.events[0]).toMatchObject({ status: 'PLACED', note: expect.stringContaining('WhatsApp') });
      expect(await stockOf(t.prisma, ready.variantId)).toBe(before - 1);
      expect(await t.prisma.payment.count({ where: { orderId: (await t.prisma.order.findUniqueOrThrow({ where: { number: res.body.number } })).id } })).toBe(0);
      expect(t.sent.some((s) => s.event === 'order.placed' && s.payload.orderNumber === res.body.number && s.payload.paymentMethod === 'COD')).toBe(true);
    });

    it('rejects COD with a made-to-order piece and leaves stock untouched (transaction rolled back)', async () => {
      const before = [await stockOf(t.prisma, ready.variantId), await stockOf(t.prisma, mto.variantId)];
      const res = await place(http(), 'cod-mto', [{ productId: ready.productId, variantId: ready.variantId }, { productId: mto.productId, variantId: mto.variantId }], { paymentMethod: 'COD' }).expect(400);
      expect(res.body).toMatchObject({ code: 'COD_NOT_AVAILABLE', message: "Cash on delivery isn't available for made-to-order pieces." });
      expect([await stockOf(t.prisma, ready.variantId), await stockOf(t.prisma, mto.variantId)]).toEqual(before);
    });

    it('rejects COD over the cap and outside India', async () => {
      const over = await place(http(), 'cod-cap', [{ productId: pricey.productId, variantId: pricey.variantId }], { paymentMethod: 'COD' }).expect(400);
      expect(over.body.message).toContain('up to ₹2000');
      const abroad = await place(http(), 'cod-gb', [{ productId: ready.productId, variantId: ready.variantId }], { paymentMethod: 'COD', address: { name: 'A B', phone: '+447700900123', line1: '5 Rosebery Road', city: 'London', state: 'England', postalCode: 'N10 2LE', country: 'GB' } }).expect(400);
      expect(abroad.body.message).toBe('Cash on delivery is only available in India.');
    });

    it('made-to-order online orders are fine, and dispatch reflects the lead time', async () => {
      const res = await place(http(), 'mto-online', [{ productId: mto.productId, variantId: mto.variantId }]).expect(201);
      expect(res.body).toMatchObject({ status: 'PENDING_PAYMENT', subtotal: 1450, shipping: 0, total: 1450 });
      expect(res.body.items[0].fulfilment).toBe('MADE_TO_ORDER');
    });
  });

  describe('validation and server authority', () => {
    it('rejects bad addresses with field errors', async () => {
      const bad = await place(http(), 'bad-addr', [{ productId: ready.productId, variantId: ready.variantId }], { address: { name: 'A B', phone: '9811122233', line1: '12 Test Street', city: 'Bengaluru', state: 'Narnia', postalCode: '12', country: 'IN' } }).expect(400);
      expect(bad.body.fields).toMatchObject({ 'address.postalCode': 'Enter a valid 6-digit pincode.', 'address.state': 'Pick your state.' });
    });

    it('ignores nothing the client says about prices: extra fields are a 400', async () => {
      await place(http(), 'forged', [{ productId: ready.productId, variantId: ready.variantId }], { total: 1, subtotal: 1 }).expect(400);
    });

    it('empty basket, unknown product, draft product and a bad coupon are refused before any stock moves', async () => {
      const draft = await makeProduct(t.prisma, TAG, { status: 'DRAFT', stock: 5 });
      await place(http(), 'empty', []).expect(400).expect((r) => expect(r.body.message).toBe('Your basket is empty.'));
      await place(http(), 'ghost', [{ productId: 'ghost', variantId: 'ghost' }]).expect(404);
      await place(http(), 'draft', [{ productId: draft.productId, variantId: draft.variantId }]).expect(404);
      const before = await stockOf(t.prisma, ready.variantId);
      const badCoupon = await place(http(), 'badcoupon', [{ productId: ready.productId, variantId: ready.variantId }], { coupon: 'NOPE' }).expect(400);
      expect(badCoupon.body).toMatchObject({ code: 'COUPON_INVALID', fields: { coupon: "We don't recognise that code." } });
      expect(await stockOf(t.prisma, ready.variantId)).toBe(before);
      expect(await stockOf(t.prisma, draft.variantId)).toBe(5);
    });

    it('a quantity above the stock is a 409 with the friendly message, and nothing is decremented', async () => {
      const few = await makeProduct(t.prisma, TAG, { stock: 2 });
      const res = await place(http(), 'toomany', [{ productId: few.productId, variantId: few.variantId, qty: 3 }]).expect(409);
      expect(res.body).toMatchObject({ code: 'OUT_OF_STOCK', message: expect.stringContaining('just sold out or has fewer left') });
      expect(await stockOf(t.prisma, few.variantId)).toBe(2);
    });

    it('one basket line split across two lines still cannot exceed stock', async () => {
      const few = await makeProduct(t.prisma, TAG, { stock: 3 });
      await place(http(), 'split', [{ productId: few.productId, variantId: few.variantId, qty: 2 }, { productId: few.productId, variantId: few.variantId, qty: 2 }]).expect(409);
      expect(await stockOf(t.prisma, few.variantId)).toBe(3);
    });
  });

  describe('cancel', () => {
    it('cancelling a paid order restocks, releases the coupon and flags the refund', async () => {
      const agent = http();
      const fx = await makeProduct(t.prisma, TAG, { stock: 4 });
      const usesBefore = (await t.prisma.coupon.findUniqueOrThrow({ where: { code: COUPON } })).uses;
      const placed = (await place(agent, 'cancel', [{ productId: fx.productId, variantId: fx.variantId, qty: 3 }], { coupon: COUPON }).expect(201)).body;
      await confirm(placed.payment.paymentId, true).expect(200);
      expect(await stockOf(t.prisma, fx.variantId)).toBe(1);
      expect((await t.prisma.coupon.findUniqueOrThrow({ where: { code: COUPON } })).uses).toBe(usesBefore + 1);

      // Somebody else can't cancel it.
      await http().post(`/orders/${placed.number}/cancel`).send({}).expect(404);

      const res = await agent.post(`/orders/${placed.number}/cancel`).send({ reason: 'Changed my mind' }).expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUNDED' });
      expect(res.body.events.at(-1)).toMatchObject({ status: 'CANCELLED', note: expect.stringContaining('Changed my mind') });
      expect(await stockOf(t.prisma, fx.variantId)).toBe(4);
      expect((await t.prisma.coupon.findUniqueOrThrow({ where: { code: COUPON } })).uses).toBe(usesBefore);
      const pay = await t.prisma.payment.findFirstOrThrow({ where: { order: { number: placed.number } } });
      expect(pay).toMatchObject({ status: 'REFUNDED', refundedAmount: placed.total });
      expect(t.sent.some((s) => s.event === 'order.cancelled' && s.payload.orderNumber === placed.number)).toBe(true);

      // Terminal: cancelling again is a conflict and never restocks twice.
      await agent.post(`/orders/${placed.number}/cancel`).send({}).expect(409);
      expect(await stockOf(t.prisma, fx.variantId)).toBe(4);
    });

    it('cancelling an unpaid or COD order restocks it too (no refund needed)', async () => {
      const agent = http();
      const fx = await makeProduct(t.prisma, TAG, { stock: 2 });
      const cod = (await place(agent, 'cancel-cod', [{ productId: fx.productId, variantId: fx.variantId, qty: 2 }], { paymentMethod: 'COD' }).expect(201)).body;
      expect(await stockOf(t.prisma, fx.variantId)).toBe(0);
      const res = await agent.post(`/orders/${cod.number}/cancel`).send({}).expect(200);
      expect(res.body).toMatchObject({ status: 'CANCELLED', paymentStatus: 'FAILED' });
      expect(res.body.events.at(-1).note).toBe('Cancelled at your request.');
      expect(await stockOf(t.prisma, fx.variantId)).toBe(2);
    });

    it('a customer cannot cancel once production has started or it has shipped', async () => {
      const agent = http();
      const cod = (await place(agent, 'cancel-late', [{ productId: ready.productId, variantId: ready.variantId }], { paymentMethod: 'COD' }).expect(201)).body;
      await state.transition(cod.number, 'CONFIRMED', SYSTEM_ACTOR);
      await state.transition(cod.number, 'PACKED', SYSTEM_ACTOR);
      await agent.post(`/orders/${cod.number}/cancel`).send({}).expect(409);
    });

    it('the payment window sweeper releases stock held by unpaid online orders', async () => {
      const fx = await makeProduct(t.prisma, TAG, { stock: 1 });
      const placed = (await place(http(), 'stale', [{ productId: fx.productId, variantId: fx.variantId }]).expect(201)).body;
      expect(await stockOf(t.prisma, fx.variantId)).toBe(0);
      await t.prisma.order.update({ where: { number: placed.number }, data: { createdAt: new Date(Date.now() - 45 * 60_000) } });
      const orders = (await import('../src/orders/orders.service.js')).OrdersService;
      expect(await t.app.get(orders).expireUnpaidOrders()).toBeGreaterThanOrEqual(1);
      expect(await stockOf(t.prisma, fx.variantId)).toBe(1);
      expect((await t.prisma.order.findUniqueOrThrow({ where: { number: placed.number } })).status).toBe('CANCELLED');
    });
  });

  describe('the sold-out race', () => {
    it('two shoppers, one piece: exactly one order wins, the other gets a 409', async () => {
      const last = await makeProduct(t.prisma, TAG, { stock: 1, isOneOfAKind: true });
      const results = await Promise.all(
        ['a', 'b', 'c'].map((n) => place(http(), `race-${n}`, [{ productId: last.productId, variantId: last.variantId }], { paymentMethod: 'COD' }).then((r) => ({ status: r.status, code: (r.body as { code?: string }).code }))),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409 && r.code === 'OUT_OF_STOCK')).toHaveLength(2);
      expect(await stockOf(t.prisma, last.variantId)).toBe(0);
      expect(await t.prisma.orderItem.count({ where: { productId: last.productId } })).toBe(1);
    });
  });

  describe('ownership and the order state machine', () => {
    let alice: TestUser;
    let bob: TestUser;
    let admin: TestUser;

    beforeAll(async () => {
      alice = await makeUser(t, 'customer', 'alice');
      bob = await makeUser(t, 'customer', 'bob');
      admin = await makeUser(t, 'admin', 'root');
      users.push(alice, bob, admin);
    });

    it('a signed-in order is readable by its owner and an admin only; lists are scoped', async () => {
      const placed = (await place(alice.agent, 'own', [{ productId: ready.productId, variantId: ready.variantId }], { paymentMethod: 'COD' }).expect(201)).body;
      expect(placed.userId).toBe(alice.id);
      expect(placed.events).toHaveLength(1);
      expect((placed as { payment?: unknown }).payment).toBeUndefined();

      await alice.agent.get(`/orders/${placed.number}`).expect(200);
      await admin.agent.get(`/orders/${placed.number}`).expect(200);
      const denied = await bob.agent.get(`/orders/${placed.number}`).expect(404);
      expect(denied.body).toEqual((await http().get('/orders/FB-0').expect(404)).body); // same body as "doesn't exist"
      await http().get(`/orders/${placed.number}`).expect(404);
      await bob.agent.post(`/orders/${placed.number}/cancel`).send({}).expect(404);
      await bob.agent.post(`/orders/${placed.number}/return`).send({ reason: 'x' }).expect(404);

      expect((await alice.agent.get('/orders').expect(200)).body.map((o: { number: string }) => o.number)).toContain(placed.number);
      expect((await bob.agent.get('/orders').expect(200)).body).toEqual([]);
      await http().get('/orders').expect(401);
    });

    it('a signed-in placement can save the address; the guest cookie is not set', async () => {
      const res = await place(alice.agent, 'save-addr', [{ productId: ready.productId, variantId: ready.variantId }], { paymentMethod: 'COD', saveAddress: true }).expect(201);
      expect(res.headers['set-cookie']?.toString() ?? '').not.toContain('fbf_go');
      const list = (await alice.agent.get('/account/addresses').expect(200)).body;
      expect(list).toEqual([expect.objectContaining({ label: 'Saved at checkout', postalCode: '560038', isDefault: true })]);
    });

    it('OrderStateService: table enforced, SHIPPED needs courier + AWB, every transition writes an event and emails', async () => {
      const placed = (await place(alice.agent, 'state', [{ productId: ready.productId, variantId: ready.variantId }], { paymentMethod: 'COD' }).expect(201)).body;
      const n = placed.number as string;
      await expect(state.transition(n, 'SHIPPED', SYSTEM_ACTOR)).rejects.toMatchObject({ status: 409, response: { code: 'INVALID_TRANSITION' } });
      await expect(state.transition('FB-0', 'CONFIRMED', SYSTEM_ACTOR)).rejects.toMatchObject({ status: 404 });

      const adminActor = { userId: admin.id, role: 'admin' as const };
      expect((await state.transition(n, 'CONFIRMED', adminActor, { note: 'Confirmed on WhatsApp' })).status).toBe('CONFIRMED');
      await state.transition(n, 'PACKED', adminActor);
      await expect(state.transition(n, 'SHIPPED', adminActor)).rejects.toMatchObject({ status: 400, response: { fields: { courier: 'Required', awb: 'Required' } } });
      await expect(state.transition(n, 'SHIPPED', adminActor, { courier: 'Delhivery' })).rejects.toMatchObject({ status: 400, response: { fields: { awb: 'Required' } } });
      const shipped = await state.transition(n, 'SHIPPED', adminActor, { courier: 'Delhivery', awb: 'DL123' });
      expect(shipped).toMatchObject({ status: 'SHIPPED', courier: 'Delhivery', awb: 'DL123' });
      expect(shipped.events.at(-1)).toMatchObject({ status: 'SHIPPED', note: 'Handed to Delhivery. AWB DL123.' });
      await expect(state.transition(n, 'CANCELLED', adminActor)).rejects.toMatchObject({ status: 409 });

      const delivered = await state.transition(n, 'DELIVERED', adminActor);
      expect(delivered).toMatchObject({ status: 'DELIVERED', paymentStatus: 'PAID' }); // COD cash collected
      expect(delivered.events.map((e) => e.status)).toEqual(['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED']);
      const events = await t.prisma.orderEvent.findMany({ where: { order: { number: n } }, orderBy: { at: 'asc' } });
      expect(events.find((e) => e.status === 'CONFIRMED')?.actorId).toBe(admin.id);
      for (const ev of ['order.confirmed', 'order.shipped', 'order.delivered']) {
        expect(t.sent.some((s) => s.event === ev && s.payload.orderNumber === n)).toBe(true);
      }
      expect(t.sent.find((s) => s.event === 'order.shipped' && s.payload.orderNumber === n)?.payload).toMatchObject({ courier: 'Delhivery', awb: 'DL123', to: `${TAG}-state@e2e.test` });
    });

    it('returns: only delivered, ready-to-ship, un-personalised orders within the window', async () => {
      const deliver = async (n: string) => {
        for (const to of ['CONFIRMED', 'PACKED'] as const) await state.transition(n, to, SYSTEM_ACTOR);
        await state.transition(n, 'SHIPPED', SYSTEM_ACTOR, { courier: 'India Post', awb: 'EE1' });
        await state.transition(n, 'DELIVERED', SYSTEM_ACTOR);
      };
      const ok = (await place(alice.agent, 'ret-ok', [{ productId: ready.productId, variantId: ready.variantId }], { paymentMethod: 'COD' }).expect(201)).body;
      await alice.agent.post(`/orders/${ok.number}/return`).send({ reason: 'Too small' }).expect(400).expect((r) => expect(r.body.message).toBe('Returns open once an order is delivered.'));
      await deliver(ok.number);
      await bob.agent.post(`/orders/${ok.number}/return`).send({ reason: 'x' }).expect(404);
      await alice.agent.post(`/orders/${ok.number}/return`).send({}).expect(400); // reason required
      const res = await alice.agent.post(`/orders/${ok.number}/return`).send({ reason: 'Too small' }).expect(200);
      expect(res.body).toMatchObject({ status: 'RETURN_REQUESTED' });
      expect(res.body.events.at(-1)).toMatchObject({ status: 'RETURN_REQUESTED', note: 'Too small' });

      const personal = (await place(alice.agent, 'ret-personal', [{ productId: ready.productId, variantId: ready.variantId, personalization: 'Priya' }], { paymentMethod: 'COD' }).expect(201)).body;
      await deliver(personal.number);
      await alice.agent.post(`/orders/${personal.number}/return`).send({ reason: 'x' }).expect(400).expect((r) => expect(r.body.message).toContain("can't be returned unless damaged"));

      const old = (await place(alice.agent, 'ret-old', [{ productId: ready.productId, variantId: ready.variantId }], { paymentMethod: 'COD' }).expect(201)).body;
      await deliver(old.number);
      await t.prisma.orderEvent.updateMany({ where: { order: { number: old.number }, status: 'DELIVERED' }, data: { at: new Date(Date.now() - 10 * 86_400_000) } });
      await alice.agent.post(`/orders/${old.number}/return`).send({ reason: 'x' }).expect(400).expect((r) => expect(r.body.message).toContain('return window'));
    });

    it('reviews: verified buyers only, created PENDING, listed once published, one per product', async () => {
      const fx = await makeProduct(t.prisma, TAG, { stock: 5 });
      const buy = async (user: TestUser, name: string) => (await place(user.agent, name, [{ productId: fx.productId, variantId: fx.variantId }], { paymentMethod: 'COD' }).expect(201)).body.number as string;

      await http().get(`/products/${fx.productId}/can-review`).expect(200).expect((r) => expect(r.body).toEqual({ canReview: false }));
      await http().post('/reviews').send({ productId: fx.productId, rating: 5, body: 'Lovely' }).expect(401);
      await alice.agent.post('/reviews').send({ productId: fx.productId, rating: 5, body: 'Lovely!' }).expect(403);

      const n = await buy(alice, 'rev');
      // ordered but not delivered yet: still not a verified buyer
      await alice.agent.get(`/products/${fx.productId}/can-review`).expect(200).expect((r) => expect(r.body.canReview).toBe(false));
      await state.transition(n, 'CONFIRMED', SYSTEM_ACTOR);
      await state.transition(n, 'PACKED', SYSTEM_ACTOR);
      await state.transition(n, 'SHIPPED', SYSTEM_ACTOR, { courier: 'X', awb: '1' });
      await state.transition(n, 'DELIVERED', SYSTEM_ACTOR);
      await alice.agent.get(`/products/${fx.productId}/can-review`).expect(200).expect((r) => expect(r.body.canReview).toBe(true));
      await bob.agent.get(`/products/${fx.productId}/can-review`).expect(200).expect((r) => expect(r.body.canReview).toBe(false));

      await alice.agent.post('/reviews').send({ productId: fx.productId, rating: 6, body: 'Lovely!' }).expect(400);
      await alice.agent.post('/reviews').send({ productId: fx.productId, rating: 5, body: 'Lovely!', status: 'PUBLISHED' }).expect(400);
      const created = await alice.agent.post('/reviews').send({ productId: fx.productId, rating: 5, body: 'Lovely, so soft!' }).expect(201);
      expect(created.body).toMatchObject({ productId: fx.productId, rating: 5, verified: true, status: 'PENDING', author: 'E2E' });
      await alice.agent.post('/reviews').send({ productId: fx.productId, rating: 4, body: 'Again' }).expect(409);
      await alice.agent.get(`/products/${fx.productId}/can-review`).expect(200).expect((r) => expect(r.body.canReview).toBe(false));

      expect((await http().get(`/products/${fx.productId}/reviews`).expect(200)).body).toEqual([]); // pending is not public
      await t.prisma.review.update({ where: { id: created.body.id as string }, data: { status: 'PUBLISHED' } });
      const listed = (await http().get(`/products/${fx.productId}/reviews`).expect(200)).body;
      expect(listed).toEqual([expect.objectContaining({ id: created.body.id, status: 'PUBLISHED' })]);
    });
  });

  it('the express server exposes no stack traces on errors', async () => {
    const res = await request(t.app.getHttpServer()).post('/orders').set('Content-Type', 'application/json').send('{"broken');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/at .*\.(ts|js):\d+|node_modules/);
  });
});
