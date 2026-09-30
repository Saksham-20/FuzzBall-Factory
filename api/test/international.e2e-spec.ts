import { bootCommerce, cleanupCommerce, guest, makeProduct, MOCK_PAYMENT_ENV, orderBody, type CommerceApp, type Fixture } from './helpers/commerce.js';

/**
 * Orders to addresses outside India, against the real DB with mock payments: each shipping zone prices by its own
 * rate (free shipping is an India-only rule), prepaid only, postal codes checked per country, a few countries refused.
 */
const TAG = `intl${Date.now()}`;

const ADDRESS: Record<string, { name: string; phone: string; line1: string; city: string; state: string; postalCode: string; country: string }> = {
  GB: { name: 'A B', phone: '+447700900123', line1: '5 Rosebery Road', city: 'London', state: 'England', postalCode: 'N10 2LE', country: 'GB' },
  US: { name: 'A B', phone: '+14155550123', line1: '1 Market St', city: 'San Francisco', state: 'CA', postalCode: '94103', country: 'US' },
  AE: { name: 'A B', phone: '+971501234567', line1: 'Marina Walk', city: 'Dubai', state: '', postalCode: '000', country: 'AE' },
  JP: { name: 'A B', phone: '+81312345678', line1: '1-1 Chiyoda', city: 'Tokyo', state: '', postalCode: '100-0001', country: 'JP' },
};

describe('international orders (e2e, mock payments)', () => {
  let t: CommerceApp;
  let piece: Fixture;
  let big: Fixture;
  const http = () => guest(t);
  const quote = (country: string, fixture = piece, qty = 1) =>
    http().post('/checkout/quote').send({ lines: [{ productId: fixture.productId, variantId: fixture.variantId, qty }], country }).expect(200);
  const place = (name: string, country: keyof typeof ADDRESS, o: Record<string, unknown> = {}) =>
    http().post('/orders').send(orderBody(`${TAG}-${name}`, [{ productId: piece.productId, variantId: piece.variantId }], { address: ADDRESS[country], ...o }));

  beforeAll(async () => {
    t = await bootCommerce({ env: MOCK_PAYMENT_ENV });
    piece = await makeProduct(t.prisma, TAG, { price: 400, stock: 50 });
    big = await makeProduct(t.prisma, TAG, { price: 1500, stock: 50 }); // over the free-shipping threshold for India
  });
  afterAll(async () => {
    await cleanupCommerce(t.prisma, { tags: [TAG] });
    t.restoreEnv();
    await t.app.close();
  });

  it.each([
    ['AE', 'South Asia & Middle East', 899],
    ['GB', 'UK & Europe', 1499],
    ['US', 'USA, Canada & Australia', 1799],
    ['JP', 'Rest of world', 1999],
    ['BR', 'Rest of world', 1999],
  ])('%s is priced in the %s zone at %i', async (country, zone, rate) => {
    const res = await quote(country);
    expect(res.body).toMatchObject({ shipping: rate, shippingLabel: `International: ${zone}`, codEligible: false });
  });

  it('free shipping is an India-only rule: a big basket still pays the zone rate abroad', async () => {
    expect((await quote('IN', big)).body.shipping).toBe(0);
    expect((await quote('GB', big)).body.shipping).toBe(1499);
  });

  it('places a prepaid order to the UK and stores the address and zone charge', async () => {
    const res = await place('gb', 'GB').expect(201);
    expect(res.body).toMatchObject({ status: 'PENDING_PAYMENT', shipping: 1499, total: 400 + 1499 });
    expect(res.body.address).toMatchObject({ country: 'GB', postalCode: 'N10 2LE' });
  });

  it('accepts a country with no postal codes (000) and one the zone table does not name', async () => {
    await place('ae', 'AE').expect(201);
    const jp = await place('jp', 'JP').expect(201);
    expect(jp.body.shipping).toBe(1999);
  });

  it('refuses cash on delivery abroad', async () => {
    const res = await place('cod', 'US', { paymentMethod: 'COD' }).expect(400);
    expect(res.body.message).toBe('Cash on delivery is only available in India.');
  });

  it('refuses a postal code in the wrong shape for its country, with the field named', async () => {
    const res = await place('badzip', 'US', { address: { ...ADDRESS.US, postalCode: '9410' } }).expect(400);
    expect(res.body.fields['address.postalCode']).toMatch(/looks like 94103/);
    const gb = await place('badpc', 'GB', { address: { ...ADDRESS.GB, postalCode: '12345' } }).expect(400);
    expect(gb.body.fields['address.postalCode']).toBeDefined();
  });

  it('refuses countries we do not ship to, on the quote-adjacent checks and on the order', async () => {
    const order = await place('blocked', 'US', { address: { ...ADDRESS.US, country: 'IR', postalCode: '12345' } }).expect(400);
    expect(order.body.fields['address.country']).toBe("We can't ship to that country.");
    const check = await http().get('/shipping/check').query({ country: 'KP', postalCode: '' }).expect(200);
    expect(check.body).toMatchObject({ serviceable: false, message: "We can't ship to that country." });
  });

  it('the delivery check reports the zone and transit window for a served country', async () => {
    const check = await http().get('/shipping/check').query({ country: 'US', postalCode: '94103', leadTimeDays: 3 }).expect(200);
    expect(check.body).toMatchObject({ serviceable: true, transitDays: '10–16 days', codAvailable: false });
    expect(new Date(check.body.deliverBy).getTime()).toBeGreaterThan(Date.now());
  });
});
