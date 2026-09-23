import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { bootApp, makeUser, type TestApp, type TestUser } from './helpers/e2e.js';

/**
 * The whole custom-order journey against the real app and database, with a customer, another customer and
 * an admin. Payments use the dev mock confirm endpoint. Everything created here is removed afterwards.
 */
describe('custom work orders (e2e)', () => {
  let t: TestApp;
  let app: INestApplication;
  let maya: TestUser;
  let other: TestUser;
  let admin: TestUser;
  let category: string;
  const created: string[] = [];

  const body = (over: Record<string, unknown> = {}) => ({
    kind: 'NEW',
    category,
    title: 'Graduation bear',
    description: 'A small crochet bear in a graduation cap. Cream and navy, about 15 cm. For my sister.',
    colours: ['Cream', 'Navy'],
    size: 'About 15 cm',
    quantity: 1,
    budgetMin: 1500,
    budgetMax: 2200,
    neededBy: '',
    occasion: 'Graduation',
    personalization: 'Priya',
    references: ['/uploads/ref-1.jpg'],
    country: 'IN',
    postalCode: '560038',
    phone: '98765 43210',
    ...over,
  });
  const quoteBody = (amounts: number[], over: Record<string, unknown> = {}) => ({
    breakdown: amounts.map((amount, i) => ({ label: ['Materials', 'Crochet time', 'Design & packaging'][i] ?? `Line ${i + 1}`, amount })),
    timelineDays: 8,
    revisions: 1,
    scope: 'One piece as described. One round of changes before the final photos.',
    ...over,
  });

  async function newRequest(over: Record<string, unknown> = {}): Promise<string> {
    const res = await maya.agent.post('/custom').send(body(over)).expect(201);
    created.push(res.body.number);
    return res.body.number as string;
  }
  const get = async (who: TestUser, wo: string) => (await who.agent.get(`/custom/${wo}`).expect(200)).body;
  const adminPost = (wo: string, action: string, payload: object = {}) => admin.agent.post(`/admin/custom/${wo}/${action}`).send(payload);
  const mockPay = (paymentId: string) => request(app.getHttpServer()).post(`/payments/mock/${paymentId}/confirm`).send({ ok: true });

  beforeAll(async () => {
    t = await bootApp();
    app = t.app;
    category = (await t.prisma.category.findFirstOrThrow()).slug;
    [maya, other, admin] = [await makeUser(t, 'customer', 'maya'), await makeUser(t, 'customer', 'other'), await makeUser(t, 'admin', 'admin')];
  });

  afterAll(async () => {
    const requests = await t.prisma.customRequest.findMany({ where: { number: { in: created } }, select: { id: true } });
    const ids = requests.map((r) => r.id);
    await t.prisma.payment.deleteMany({ where: { requestId: { in: ids } } });
    await t.prisma.idempotencyKey.deleteMany({ where: { userId: { in: [maya.id, other.id, admin.id] } } });
    await t.prisma.customRequest.deleteMany({ where: { id: { in: ids } } });
    await t.prisma.auditLog.deleteMany({ where: { actorId: admin.id } });
    // Give back the WO numbers this file used, but only when no real work order exists to collide with.
    if ((await t.prisma.customRequest.count()) === 0) await t.prisma.counter.updateMany({ where: { key: 'work_order' }, data: { value: 0 } });
    await t.prisma.user.deleteMany({ where: { id: { in: [maya.id, other.id, admin.id] } } });
    await app.close();
  });

  it('needs a login, validates the form per field, and never accepts someone else’s userId', async () => {
    await request(app.getHttpServer()).get('/custom').expect(401);
    await request(app.getHttpServer()).post('/custom').send(body()).expect(401);
    const res = await maya.agent.post('/custom').send(body({ description: 'short', quantity: 0, userId: other.id, category: 'no-such-category' })).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(res.body.fields)).toEqual(expect.arrayContaining(['description', 'quantity', 'userId']));
    const semantic = await maya.agent.post('/custom').send(body({ category: 'no-such-category', budgetMin: 900, budgetMax: 100, postalCode: '12' })).expect(400);
    expect(Object.keys(semantic.body.fields).sort()).toEqual(['budgetMax', 'category', 'postalCode']);
  });

  it('runs the full journey: request → quote → counters → re-quotes → accept → pay → progress → approve → pay → ship → deliver', async () => {
    // 1. Customer sends the request
    const created1 = await maya.agent.post('/custom').send(body()).expect(201);
    const wo = created1.body.number as string;
    created.push(wo);
    expect(wo).toMatch(/^WO-\d{3,}$/);
    expect(created1.body).toMatchObject({
      status: 'REQUESTED', kind: 'NEW', customerName: 'E2E maya', customerPhone: '+919876543210', references: ['/uploads/ref-1.jpg'],
      quotes: [], messages: [], events: [{ status: 'REQUESTED', note: 'Work order sent.' }],
    });
    expect(created1.body.userId).toBe(maya.id);
    expect(created1.body).not.toHaveProperty('notes');
    expect(t.sent.at(-1)).toMatchObject({ event: 'workorder.received', payload: { to: maya.email, workOrderNumber: wo } });

    // 2. Ownership: another customer gets a 404, a guest a 401, the admin can read it
    await other.agent.get(`/custom/${wo}`).expect(404);
    await other.agent.post(`/custom/${wo}/messages`).send({ body: 'hi' }).expect(404);
    await request(app.getHttpServer()).get(`/custom/${wo}`).expect(401);
    expect((await get(admin, wo)).number).toBe(wo);
    expect((await other.agent.get('/custom').expect(200)).body.map((r: { number: string }) => r.number)).not.toContain(wo);
    expect((await maya.agent.get('/custom').expect(200)).body.map((r: { number: string }) => r.number)).toContain(wo);

    // 3. Conversation
    const msg = await maya.agent.post(`/custom/${wo}/messages`).send({ body: 'Could the cap have a gold tassel?' }).expect(200);
    expect(msg.body.messages).toEqual([expect.objectContaining({ author: 'customer', body: 'Could the cap have a gold tassel?' })]);
    const reply = await admin.agent.post(`/admin/custom/${wo}/messages`).send({ body: 'Yes, easy to add.' }).expect(200);
    expect(reply.body.messages.at(-1)).toMatchObject({ author: 'maker' });

    // 4. Maker reviews and quotes (deposit % is snapshotted from settings)
    expect((await adminPost(wo, 'under-review').expect(200)).body.status).toBe('UNDER_REVIEW');
    await adminPost(wo, 'under-review').expect(400);
    await adminPost(wo, 'quote', quoteBody([])).expect(400);
    const settings = (await admin.agent.get('/admin/settings').expect(200)).body;
    const q1 = (await adminPost(wo, 'quote', quoteBody([600, 1000, 250])).expect(200)).body;
    expect(q1.status).toBe('QUOTED');
    expect(q1.quotes).toHaveLength(1);
    expect(q1.quotes[0]).toMatchObject({ price: 1850, depositPct: settings.depositPct, status: 'SENT', timelineDays: 8, revisions: 1 });
    expect(q1.quotes[0].breakdown.reduce((s: number, l: { amount: number }) => s + l.amount, 0)).toBe(1850);
    expect(new Date(q1.quotes[0].validUntil).getTime()).toBeGreaterThan(Date.now());
    expect(t.sent.at(-1)).toMatchObject({ event: 'workorder.quoted', payload: { amount: 1850 } });

    // 5. First counter: must be lower than the quote
    const quote1 = q1.quotes[0].id as string;
    const tooHigh = await maya.agent.post(`/custom/${wo}/quotes/${quote1}/counter`).send({ amount: 1850, note: 'x' }).expect(400);
    expect(tooHigh.body).toMatchObject({ message: 'A counter-offer has to be lower than the quote.', fields: { amount: 'Must be lower than the quote' } });
    await maya.agent.post(`/custom/${wo}/quotes/${quote1}/counter`).send({ amount: 10.5 }).expect(400);
    const c1 = (await maya.agent.post(`/custom/${wo}/quotes/${quote1}/counter`).send({ amount: 1500, note: 'Could we do ₹1,500?' }).expect(200)).body;
    expect(c1.status).toBe('COUNTERED');
    expect(c1.quotes[0]).toMatchObject({ status: 'COUNTERED', counter: { amount: 1500, note: 'Could we do ₹1,500?' } });
    expect(t.sent.at(-1)).toMatchObject({ event: 'workorder.countered' });
    // while COUNTERED the customer can't accept or counter again
    await maya.agent.post(`/custom/${wo}/quotes/${quote1}/accept`).expect(400);

    // 6. Maker re-quotes; the old quote is superseded
    const q2 = (await adminPost(wo, 'quote', quoteBody([550, 900, 250])).expect(200)).body;
    expect(q2.status).toBe('QUOTED');
    expect(q2.quotes.map((q: { status: string }) => q.status)).toEqual(['DECLINED', 'SENT']);
    const quote2 = q2.quotes[1].id as string;

    // 7. Second (last) counter, re-quote, then the cap bites
    await maya.agent.post(`/custom/${wo}/quotes/${quote2}/counter`).send({ amount: 1600 }).expect(200);
    const q3 = (await adminPost(wo, 'quote', quoteBody([550, 850, 250], { revisions: 1 })).expect(200)).body;
    expect(q3.quotes).toHaveLength(3);
    const quote3 = q3.quotes[2].id as string;
    expect(q3.quotes[2].price).toBe(1650);
    const capped = await maya.agent.post(`/custom/${wo}/quotes/${quote3}/counter`).send({ amount: 1500 }).expect(400);
    expect(capped.body.message).toBe('You can counter up to 2 times. Accept, decline, or message us.');
    expect(q3.events.filter((e: { status: string }) => e.status === 'COUNTERED')).toHaveLength(2);

    // 8. Accept → deposit due. Payments only make sense at the right stage.
    await maya.agent.post(`/custom/${wo}/pay-deposit`).expect(400);
    await maya.agent.post(`/custom/${wo}/pay-balance`).expect(400);
    await other.agent.post(`/custom/${wo}/quotes/${quote3}/accept`).expect(404);
    const accepted = (await maya.agent.post(`/custom/${wo}/quotes/${quote3}/accept`).expect(200)).body;
    expect(accepted.status).toBe('DEPOSIT_PENDING');
    expect(accepted.quotes.at(-1).status).toBe('ACCEPTED');
    expect(accepted.events.slice(-2).map((e: { status: string }) => e.status)).toEqual(['ACCEPTED', 'DEPOSIT_PENDING']);
    expect(t.sent.at(-1)).toMatchObject({ event: 'workorder.accepted', payload: { amount: 825 } });
    await maya.agent.post(`/custom/${wo}/quotes/${quote3}/accept`).expect(400); // no longer open

    // 9. Pay the deposit through the (mock) gateway
    const dep = (await maya.agent.post(`/custom/${wo}/pay-deposit`).expect(200)).body;
    expect(dep).toMatchObject({ amountPaise: 82_500, currency: 'INR', mock: true });
    const depRow = await t.prisma.payment.findUniqueOrThrow({ where: { id: dep.paymentId } });
    expect(depRow).toMatchObject({ purpose: 'DEPOSIT', amount: 825, quoteId: quote3 });
    expect((await get(maya, wo)).status).toBe('DEPOSIT_PENDING'); // not paid yet
    await other.agent.post(`/custom/${wo}/pay-deposit`).expect(404);
    const paid = await mockPay(dep.paymentId).expect(200);
    expect(paid.body).toMatchObject({ status: 'PAID', purpose: 'DEPOSIT', customRequestNumber: wo });
    const inProgress = await get(maya, wo);
    expect(inProgress.status).toBe('IN_PROGRESS');
    expect(inProgress.events.at(-1)).toMatchObject({ status: 'IN_PROGRESS', note: "Deposit received. We're starting your piece." });
    expect(t.sent.at(-1)).toMatchObject({ event: 'workorder.deposit_paid', payload: { amount: 825 } });
    // confirming again (duplicate webhook / double click) changes nothing
    const eventCount = inProgress.events.length;
    await mockPay(dep.paymentId).expect(200);
    expect((await get(maya, wo)).events).toHaveLength(eventCount);

    // 10. Progress photos keep the status and notify
    const prog = (await adminPost(wo, 'progress', { note: 'Bear body is done.', photo: '/uploads/progress-1.jpg' }).expect(200)).body;
    expect(prog.status).toBe('IN_PROGRESS');
    expect(prog.events.at(-1)).toMatchObject({ status: 'IN_PROGRESS', note: 'Bear body is done.', photo: '/uploads/progress-1.jpg' });
    expect(t.sent.at(-1)).toMatchObject({ event: 'workorder.progress' });

    // 11. Approval loop: 1 included revision, so the second change is chargeable
    await maya.agent.post(`/custom/${wo}/approve`).expect(400);
    await adminPost(wo, 'request-approval', { note: 'All finished!', photo: '/uploads/final.jpg' }).expect(200);
    expect(t.sent.at(-1)).toMatchObject({ event: 'workorder.awaiting_approval' });
    const ch1 = (await maya.agent.post(`/custom/${wo}/request-change`).send({ note: 'Tassel a bit longer' }).expect(200)).body;
    expect(ch1).toMatchObject({ status: 'IN_PROGRESS', extraCharge: false });
    expect(ch1.messages.at(-1).body).toBe('Change requested: Tassel a bit longer');
    await adminPost(wo, 'request-approval').expect(200);
    const ch2 = (await maya.agent.post(`/custom/${wo}/request-change`).send({ note: 'Also a bigger backpack' }).expect(200)).body;
    expect(ch2).toMatchObject({ status: 'IN_PROGRESS', extraCharge: true });
    await maya.agent.post(`/custom/${wo}/request-change`).send({ note: 'again' }).expect(400); // not awaiting approval any more
    await adminPost(wo, 'request-approval').expect(200);

    // 12. Approve → balance due → pay → ready to ship
    const approved = (await maya.agent.post(`/custom/${wo}/approve`).expect(200)).body;
    expect(approved.status).toBe('BALANCE_PENDING');
    expect(t.sent.at(-1)).toMatchObject({ event: 'workorder.balance_due', payload: { amount: 825 } });
    await maya.agent.post(`/custom/${wo}/pay-deposit`).expect(400);
    const bal = (await maya.agent.post(`/custom/${wo}/pay-balance`).expect(200)).body;
    expect(bal).toMatchObject({ amountPaise: 82_500, mock: true });
    expect((await t.prisma.payment.findUniqueOrThrow({ where: { id: bal.paymentId } })).purpose).toBe('BALANCE');
    expect((await mockPay(bal.paymentId).expect(200)).body).toMatchObject({ status: 'PAID', purpose: 'BALANCE' });
    const ready = await get(maya, wo);
    expect(ready.status).toBe('READY_TO_SHIP');
    expect(ready.events.at(-1)).toMatchObject({ status: 'READY_TO_SHIP', note: "Paid in full. We'll ship it soon." });

    // 13. Ship needs courier + AWB and the right stage; then deliver
    const noAwb = await adminPost(wo, 'ship', { courier: 'Delhivery' }).expect(400);
    expect(noAwb.body.fields).toHaveProperty('awb');
    const shipped = (await adminPost(wo, 'ship', { courier: 'Delhivery', awb: 'DL7845123001' }).expect(200)).body;
    expect(shipped).toMatchObject({ status: 'SHIPPED', courier: 'Delhivery', awb: 'DL7845123001' });
    expect(shipped.events.at(-1).note).toBe('Handed to Delhivery. AWB DL7845123001.');
    expect(t.sent.at(-1)).toMatchObject({ event: 'workorder.shipped', payload: { courier: 'Delhivery', awb: 'DL7845123001' } });
    await adminPost(wo, 'ship', { courier: 'X', awb: 'Y' }).expect(400);
    expect((await adminPost(wo, 'deliver').expect(200)).body.status).toBe('DELIVERED');
    await adminPost(wo, 'deliver').expect(400);
    await adminPost(wo, 'decline', { reason: 'nope' }).expect(400);

    // 14. The trail: statuses in order, and an audit row per admin write
    const final = await get(maya, wo);
    expect(final.events.map((e: { status: string }) => e.status)).toEqual([
      'REQUESTED', 'UNDER_REVIEW', 'QUOTED', 'COUNTERED', 'QUOTED', 'COUNTERED', 'QUOTED', 'ACCEPTED', 'DEPOSIT_PENDING', 'IN_PROGRESS', 'IN_PROGRESS',
      'AWAITING_APPROVAL', 'CHANGE_REQUESTED', 'AWAITING_APPROVAL', 'CHANGE_REQUESTED', 'AWAITING_APPROVAL', 'BALANCE_PENDING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED',
    ]);
    const audits = await t.prisma.auditLog.findMany({ where: { entity: 'CustomRequest', entityId: wo }, select: { action: true, actorId: true } });
    expect(audits.every((a) => a.actorId === admin.id)).toBe(true);
    expect(audits.map((a) => a.action)).toEqual(expect.arrayContaining(['custom.message', 'custom.under_review', 'custom.quote', 'custom.progress', 'custom.request_approval', 'custom.ship', 'custom.deliver']));
    expect(t.sent.map((s) => s.event)).toEqual(
      expect.arrayContaining(['workorder.received', 'workorder.quoted', 'workorder.countered', 'workorder.accepted', 'workorder.deposit_paid', 'workorder.progress', 'workorder.awaiting_approval', 'workorder.balance_due', 'workorder.shipped']),
    );
  });

  it('expires a quote lazily (410 on accept, EXPIRED on read) and the maker can re-quote', async () => {
    const wo = await newRequest({ title: 'Expiring quote' });
    const q = (await adminPost(wo, 'quote', quoteBody([1000], { validDays: 1 })).expect(200)).body.quotes[0];
    expect(new Date(q.validUntil).getTime() - Date.now()).toBeLessThan(25 * 3_600_000);
    await t.prisma.quote.update({ where: { id: q.id }, data: { validUntil: new Date(Date.now() - 60_000) } });

    const res = await maya.agent.post(`/custom/${wo}/quotes/${q.id}/accept`).expect(410);
    expect(res.body.message).toBe('This quote has expired. Message us to reopen it.');
    const after = await get(maya, wo);
    expect(after.status).toBe('EXPIRED');
    expect(after.quotes[0].status).toBe('EXPIRED');
    expect(after.events.at(-1)).toMatchObject({ status: 'EXPIRED', note: 'The quote expired.' });
    await maya.agent.post(`/custom/${wo}/quotes/${q.id}/counter`).send({ amount: 500 }).expect(410);

    const requoted = (await adminPost(wo, 'quote', quoteBody([1100])).expect(200)).body;
    expect(requoted.status).toBe('QUOTED');
    expect(requoted.quotes.map((x: { status: string }) => x.status)).toEqual(['EXPIRED', 'SENT']);
  });

  it('expires on a plain GET too, and the admin sweep catches quotes nobody opened', async () => {
    const wo = await newRequest({ title: 'Read expiry' });
    const q = (await adminPost(wo, 'quote', quoteBody([900])).expect(200)).body.quotes[0];
    await t.prisma.quote.update({ where: { id: q.id }, data: { validUntil: new Date(Date.now() - 1000) } });
    expect((await get(maya, wo)).status).toBe('EXPIRED');

    const wo2 = await newRequest({ title: 'Sweep expiry' });
    const q2 = (await adminPost(wo2, 'quote', quoteBody([900])).expect(200)).body.quotes[0];
    await t.prisma.quote.update({ where: { id: q2.id }, data: { validUntil: new Date(Date.now() - 1000) } });
    const list = (await admin.agent.get('/admin/custom?status=EXPIRED').expect(200)).body as { number: string }[];
    expect(list.map((r) => r.number)).toEqual(expect.arrayContaining([wo, wo2]));
  });

  it('customer can decline (→ CANCELLED); the maker can decline (→ DECLINED) and accept a counter', async () => {
    // customer declines a quote
    const a = await newRequest({ title: 'Customer declines' });
    const qa = (await adminPost(a, 'quote', quoteBody([1200])).expect(200)).body.quotes[0];
    await other.agent.post(`/custom/${a}/quotes/${qa.id}/decline`).send({}).expect(404);
    const declined = (await maya.agent.post(`/custom/${a}/quotes/${qa.id}/decline`).send({ reason: 'Found one elsewhere' }).expect(200)).body;
    expect(declined.status).toBe('CANCELLED');
    expect(declined.quotes[0].status).toBe('DECLINED');
    expect(declined.events.at(-1)).toMatchObject({ status: 'CANCELLED', note: 'Quote declined: Found one elsewhere' });

    // maker declines a new request (licensed character)
    const b = await newRequest({ title: 'Pikachu plushie' });
    await adminPost(b, 'decline', {}).expect(400);
    const bd = (await adminPost(b, 'decline', { reason: "I can't make licensed characters." }).expect(200)).body;
    expect(bd.status).toBe('DECLINED');
    expect(bd.messages.at(-1)).toMatchObject({ author: 'maker', body: "I can't make licensed characters." });
    expect(t.sent.at(-1)).toMatchObject({ event: 'workorder.declined', payload: { to: maya.email, note: "I can't make licensed characters." } });

    // maker accepts a counter-offer: price becomes the counter, deposit due
    const c = await newRequest({ title: 'Wildflower bouquet' });
    await adminPost(c, 'accept-counter').expect(400);
    const qc = (await adminPost(c, 'quote', quoteBody([701, 1001, 698])).expect(200)).body.quotes[0];
    await maya.agent.post(`/custom/${c}/quotes/${qc.id}/counter`).send({ amount: 2000, note: '7 stems?' }).expect(200);
    const ac = (await adminPost(c, 'accept-counter').expect(200)).body;
    expect(ac.status).toBe('DEPOSIT_PENDING');
    expect(ac.quotes[0]).toMatchObject({ status: 'ACCEPTED', price: 2000 });
    expect(ac.quotes[0].breakdown.reduce((s: number, l: { amount: number }) => s + l.amount, 0)).toBe(2000);
    expect(ac.events.at(-1).note).toContain('₹1,000');
  });

  it('customizing a shelf product links it by slug; non-customizable or unknown products are refused', async () => {
    const product = await t.prisma.product.findFirst({ where: { customizable: true } });
    if (!product) return; // nothing seeded
    const ok = await maya.agent.post('/custom').send(body({ kind: 'CUSTOMIZE', baseProductSlug: product.slug, title: 'Customised' })).expect(201);
    created.push(ok.body.number);
    expect(ok.body).toMatchObject({ kind: 'CUSTOMIZE', baseProductSlug: product.slug });
    const bad = await maya.agent.post('/custom').send(body({ kind: 'CUSTOMIZE', baseProductSlug: 'no-such-product' })).expect(400);
    expect(bad.body.fields).toHaveProperty('baseProductSlug');
    await maya.agent.post('/custom').send(body({ kind: 'NEW', baseProductSlug: product.slug })).expect(400);
  });

  it('idempotent accept: the same Idempotency-Key replays the result instead of failing', async () => {
    const wo = await newRequest({ title: 'Idempotent accept' });
    const q = (await adminPost(wo, 'quote', quoteBody([800])).expect(200)).body.quotes[0];
    const key = `e2e-accept-${Date.now()}`;
    const first = await maya.agent.post(`/custom/${wo}/quotes/${q.id}/accept`).set('Idempotency-Key', key).expect(200);
    const again = await maya.agent.post(`/custom/${wo}/quotes/${q.id}/accept`).set('Idempotency-Key', key).expect(200);
    expect(again.body).toEqual(first.body);
    expect(again.body.events.filter((e: { status: string }) => e.status === 'ACCEPTED')).toHaveLength(1);
  });
});
