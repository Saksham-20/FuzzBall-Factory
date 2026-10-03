import { purgeSamples } from '../src/maintenance/purge-samples.js';
import { bootApp, PASSWORD, type TestApp } from './helpers/e2e.js';
import { makeProduct } from './helpers/commerce.js';
import { hashPassword } from '../src/common/password-hash.js';

describe('purge-samples (e2e)', () => {
  let t: TestApp;
  const tag = `purge${Date.now()}`;
  const emails = ['maya@example.com', 'arjun@example.com', 'sophie@example.com'];

  beforeAll(async () => {
    t = await bootApp();
    // The sample customers may already exist in a developer's test DB: start from a known state.
    await t.prisma.order.deleteMany({ where: { user: { email: { in: emails } } } });
    await t.prisma.user.deleteMany({ where: { email: { in: emails } } });
  });
  afterAll(async () => {
    await t.prisma.order.deleteMany({ where: { contactEmail: `${tag}@e2e.test` } });
    await t.prisma.user.deleteMany({ where: { email: { in: emails } } });
    await t.prisma.coupon.deleteMany({ where: { code: 'FIRSTFUZZ' } });
    await t.app.close();
  });

  it('dry run lists, apply deletes sample rows, and a customer with an order is kept', async () => {
    const sample = await makeProduct(t.prisma, tag);
    const real = await makeProduct(t.prisma, `${tag}real`, { extra: { sample: false } });
    const passwordHash = await hashPassword(PASSWORD);
    await t.prisma.user.create({ data: { name: 'Maya', email: 'maya@example.com', passwordHash } });
    const arjun = await t.prisma.user.create({ data: { name: 'Arjun', email: 'arjun@example.com', passwordHash } });
    await t.prisma.order.create({
      data: {
        number: `P-${tag}`, userId: arjun.id, contact: {}, contactEmail: `${tag}@e2e.test`, contactPhone: '9811122233', address: {},
        subtotal: 1, total: 1, paymentMethod: 'COD', estimatedDispatch: new Date(),
      },
    });
    await t.prisma.coupon.upsert({ where: { code: 'FIRSTFUZZ' }, update: {}, create: { code: 'FIRSTFUZZ', kind: 'PERCENT', value: 10, minCart: 0, active: true, uses: 12 } });

    const dry = await purgeSamples(t.prisma, { apply: false });
    expect(dry.applied).toBe(false);
    expect(dry.products).toContain(sample.slug);
    expect(dry.products).not.toContain(real.slug);
    expect(dry.users).toContain('maya@example.com');
    expect(dry.users).not.toContain('arjun@example.com');
    expect(dry.keptUsers.map((k) => k.email)).toEqual(['arjun@example.com']);
    expect(dry.coupons).toContain('FIRSTFUZZ');
    expect(await t.prisma.product.count({ where: { id: sample.productId } })).toBe(1);

    const done = await purgeSamples(t.prisma, { apply: true });
    expect(done.applied).toBe(true);
    expect(await t.prisma.product.count({ where: { id: sample.productId } })).toBe(0);
    expect(await t.prisma.product.count({ where: { id: real.productId } })).toBe(1);
    expect(await t.prisma.user.count({ where: { email: 'maya@example.com' } })).toBe(0);
    expect(await t.prisma.user.count({ where: { email: 'arjun@example.com' } })).toBe(1);
    expect(await t.prisma.coupon.count({ where: { code: 'FIRSTFUZZ' } })).toBe(0);
    expect(await t.prisma.auditLog.count({ where: { action: 'maintenance.purge-samples' } })).toBeGreaterThan(0);

    const again = await purgeSamples(t.prisma, { apply: false });
    expect(again.products).toEqual([]);
    expect(again.users).toEqual([]);

    await t.prisma.product.delete({ where: { id: real.productId } });
  });
});
