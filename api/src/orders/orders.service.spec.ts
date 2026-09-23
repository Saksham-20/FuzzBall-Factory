import type { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService, type OrderViewer } from './orders.service.js';

type Row = Record<string, unknown>;
const order = (over: Row = {}): Row => ({
  id: 'o1',
  number: 'FB-1001',
  userId: null,
  contact: { name: 'Guest', email: 'guest@example.com', phone: '+919811122233' },
  contactEmail: 'guest@example.com',
  contactPhone: '+919811122233',
  address: { name: 'Guest', phone: '+919811122233', line1: 'x', city: 'y', state: 'z', postalCode: '560038', country: 'IN' },
  status: 'PLACED',
  paymentMethod: 'COD',
  paymentStatus: 'COD_DUE',
  subtotal: 100, shipping: 0, codFee: 0, giftWrap: 0, discount: 0, total: 100,
  estimatedDispatch: new Date(), createdAt: new Date(), updatedAt: new Date(),
  items: [], events: [],
  ...over,
});

function service(rows: Row[]) {
  const prisma = { order: { findUnique: ({ where }: { where: { number: string } }) => Promise.resolve(rows.find((r) => r.number === where.number) ?? null) } };
  return new OrdersService(prisma as unknown as PrismaService, undefined as never, undefined as never, undefined as never, undefined as never, undefined as never, undefined as never, undefined as never);
}

const rejection = (p: Promise<unknown>) =>
  p.then(
    () => {
      throw new Error('expected a rejection');
    },
    (e: { status: number; response: unknown }) => e,
  );

const anon: OrderViewer = { guestNumbers: [] };
const asUser = (userId: string, role: 'customer' | 'admin' = 'customer', guestNumbers: string[] = []): OrderViewer => ({ user: { userId, role }, guestNumbers });

describe('OrdersService.findAccessible (ownership + guest access)', () => {
  const guestOrder = order();
  const aliceOrder = order({ number: 'FB-1002', userId: 'alice' });
  const svc = service([guestOrder, aliceOrder]);

  it("a signed-in customer reads their own order", async () => {
    await expect(svc.findAccessible('FB-1002', asUser('alice'))).resolves.toMatchObject({ number: 'FB-1002' });
  });

  it("another customer gets 404 (not 403) for someone else's order", async () => {
    await expect(svc.findAccessible('FB-1002', asUser('bob'))).rejects.toMatchObject({ status: 404 });
  });

  it('a guest gets 404 for an owned order, even with a cookie listing its number', async () => {
    await expect(svc.findAccessible('FB-1002', { guestNumbers: ['FB-1002'] })).rejects.toMatchObject({ status: 404 });
  });

  it('an admin reads any order', async () => {
    await expect(svc.findAccessible('FB-1002', asUser('root', 'admin'))).resolves.toBeTruthy();
    await expect(svc.findAccessible('FB-1001', asUser('root', 'admin'))).resolves.toBeTruthy();
  });

  it('a guest order is readable only by the browser that placed it (cookie), not by anyone with the number', async () => {
    await expect(svc.findAccessible('FB-1001', { guestNumbers: ['FB-1001'] })).resolves.toMatchObject({ number: 'FB-1001' });
    await expect(svc.findAccessible('FB-1001', anon)).rejects.toMatchObject({ status: 404 });
    await expect(svc.findAccessible('FB-1001', { guestNumbers: ['FB-9999'] })).rejects.toMatchObject({ status: 404 });
    await expect(svc.findAccessible('FB-1001', asUser('bob'))).rejects.toMatchObject({ status: 404 });
  });

  it('unknown numbers are 404 with the same message as a forbidden one', async () => {
    const missing = await svc.findAccessible('FB-0000', anon).catch((e: { response: unknown }) => e.response);
    const forbidden = await svc.findAccessible('FB-1002', anon).catch((e: { response: unknown }) => e.response);
    expect(missing).toEqual(forbidden);
  });

  it('order numbers are matched case-insensitively', async () => {
    await expect(svc.findAccessible(' fb-1001 ', { guestNumbers: ['FB-1001'] })).resolves.toBeTruthy();
  });
});

describe('OrdersService.track (number + phone/email)', () => {
  const svc = service([order()]);
  const ok = (n: string, c: string) => svc.track(n, c);

  it.each(['9811122233', '+91 98111 22233', '098111 22233', '+919811122233', '(+91) 98111-22233'])('matches phone %s', async (c) => {
    await expect(ok('FB-1001', c)).resolves.toMatchObject({ number: 'FB-1001' });
  });

  it('matches the email case-insensitively', async () => {
    await expect(ok('fb-1001', 'GUEST@example.com')).resolves.toMatchObject({ number: 'FB-1001' });
  });

  it('never reveals whether the number exists: same 404 body for a wrong contact and an unknown number', async () => {
    const wrongContact = await rejection(ok('FB-1001', '9000000000'));
    const unknown = await rejection(ok('FB-4040', '9811122233'));
    expect(wrongContact.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(wrongContact.response).toEqual(unknown.response);
  });

  it('rejects short digit fragments (no guessing by last digits) and partial emails', async () => {
    for (const c of ['22233', '811122233', '123456', 'guest', '@example.com', 'guest@example.co']) {
      await expect(ok('FB-1001', c)).rejects.toMatchObject({ status: 404 });
    }
  });

  it('does not treat a phone lookalike as an email or vice versa', async () => {
    await expect(ok('FB-1001', 'x@y.z 9811122233')).rejects.toMatchObject({ status: 404 });
  });
});
