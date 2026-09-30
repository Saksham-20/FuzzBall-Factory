import { OrdersService } from '../src/orders/orders.service.js';
import { COD_CONFIRM_WINDOW_HOURS, MAX_OPEN_ORDERS_PER_CONTACT } from '../src/orders/order-transitions.js';
import { makeUser, type TestUser } from './helpers/e2e.js';
import { bootCommerce, cleanupCommerce, guest, makeProduct, MOCK_PAYMENT_ENV, orderBody, stockOf, type CommerceApp, type Fixture } from './helpers/commerce.js';

/** Unpaid online orders and unconfirmed COD orders hold stock: capped per shopper, and COD is released if never confirmed. */
describe('stock-hold limits (e2e)', () => {
  const TAG = `hold${Date.now()}`;
  let t: CommerceApp;
  let product: Fixture;
  let user: TestUser;
  const http = () => guest(t);
  const place = (name: string, over: Record<string, unknown> = {}, agent = http()) => agent.post('/orders').send(orderBody(`${TAG}-${name}`, [{ productId: product.productId, variantId: product.variantId }], over));

  beforeAll(async () => {
    t = await bootCommerce({ env: MOCK_PAYMENT_ENV });
    product = await makeProduct(t.prisma, TAG, { price: 400, stock: 200 });
    user = await makeUser(t, 'customer', `${TAG}-user`);
  });
  afterAll(async () => {
    await cleanupCommerce(t.prisma, { tags: [TAG], userIds: [user.id] });
    t.restoreEnv();
    await t.app.close();
  });

  it('refuses a new order once an email address has three waiting, and says why', async () => {
    const email = { contact: { name: 'Hoarder', email: `${TAG}-hoard@e2e.test`, phone: '9800011100' } };
    for (let i = 0; i < MAX_OPEN_ORDERS_PER_CONTACT; i += 1) await place('hoard', { ...email, contact: { ...email.contact, phone: `98000111${10 + i}` } }).expect(201);
    const before = await stockOf(t.prisma, product.variantId);
    const res = await place('hoard', { ...email, contact: { ...email.contact, phone: '9800011199' } }).expect(429);
    expect(res.body).toMatchObject({ code: 'TOO_MANY_OPEN_ORDERS', message: expect.stringContaining('waiting on payment') });
    expect(await stockOf(t.prisma, product.variantId)).toBe(before); // the refused order held nothing

    // the same address in another case is the same shopper; a different address is not
    await place('hoard', { contact: { ...email.contact, email: `${TAG}-HOARD@e2e.test`, phone: '9800011188' } }).expect(429);
    await place('other', { contact: { name: 'Someone else', email: `${TAG}-other@e2e.test`, phone: '9800011177' } }).expect(201);
  });

  it('paying (or cancelling) frees a slot: only unpaid online and unconfirmed COD orders count', async () => {
    const contact = { name: 'Payer', email: `${TAG}-payer@e2e.test`, phone: '9800022200' };
    const orders: { number: string; payment: { paymentId: string } }[] = [];
    for (let i = 0; i < MAX_OPEN_ORDERS_PER_CONTACT; i += 1) orders.push((await place('payer', { contact: { ...contact, phone: `98000222${10 + i}` } }).expect(201)).body);
    await place('payer', { contact: { ...contact, phone: '9800022299' } }).expect(429);

    await http().post(`/payments/mock/${orders[0]!.payment.paymentId}/confirm`).send({ ok: true }).expect(200); // paid: no longer waiting
    await place('payer', { contact: { ...contact, phone: '9800022298' } }).expect(201);
  });

  it('a signed-in account is limited by its account too, whatever email it types', async () => {
    for (let i = 0; i < MAX_OPEN_ORDERS_PER_CONTACT; i += 1) await place(`acct${i}`, { contact: { name: 'Acct', email: `${TAG}-acct${i}@e2e.test`, phone: `98000333${10 + i}` } }, user.agent).expect(201);
    const res = await place('acct-extra', { contact: { name: 'Acct', email: `${TAG}-acct-extra@e2e.test`, phone: '9800033399' } }, user.agent).expect(429);
    expect(res.body.code).toBe('TOO_MANY_OPEN_ORDERS');
  });

  it('does not count phone numbers: a shared family phone is fine', async () => {
    for (let i = 0; i < MAX_OPEN_ORDERS_PER_CONTACT * 2; i += 1) await place('phone', { contact: { name: 'Family', email: `${TAG}-fam${i}@e2e.test`, phone: '9800044400' } }).expect(201);
  });

  it('releases cash-on-delivery orders the maker never confirmed, and leaves confirmed and recent ones', async () => {
    const orders = t.app.get(OrdersService);
    const stale = (await place('cod-stale', { paymentMethod: 'COD', contact: { name: 'Cod', email: `${TAG}-cod-stale@e2e.test`, phone: '9800055501' } }).expect(201)).body;
    const confirmed = (await place('cod-conf', { paymentMethod: 'COD', contact: { name: 'Cod', email: `${TAG}-cod-conf@e2e.test`, phone: '9800055502' } }).expect(201)).body;
    const fresh = (await place('cod-fresh', { paymentMethod: 'COD', contact: { name: 'Cod', email: `${TAG}-cod-fresh@e2e.test`, phone: '9800055503' } }).expect(201)).body;
    const old = new Date(Date.now() - (COD_CONFIRM_WINDOW_HOURS + 1) * 3_600_000);
    await t.prisma.order.updateMany({ where: { number: { in: [stale.number, confirmed.number] } }, data: { createdAt: old } });
    await t.prisma.order.update({ where: { number: confirmed.number }, data: { status: 'CONFIRMED' } });

    const before = await stockOf(t.prisma, product.variantId);
    expect(await orders.expireUnconfirmedCod()).toBeGreaterThanOrEqual(1);
    const status = async (n: string) => (await t.prisma.order.findUniqueOrThrow({ where: { number: n } })).status;
    expect(await status(stale.number)).toBe('CANCELLED');
    expect(await status(confirmed.number)).toBe('CONFIRMED');
    expect(await status(fresh.number)).toBe('PLACED');
    expect(await stockOf(t.prisma, product.variantId)).toBe(before + 1); // the released piece is back on the shelf
    const events = (await t.prisma.orderEvent.findMany({ where: { order: { number: stale.number } }, orderBy: { at: 'asc' } })).map((e) => e.note);
    expect(events.at(-1)).toMatch(/couldn't confirm this cash-on-delivery order/);
  });
});
