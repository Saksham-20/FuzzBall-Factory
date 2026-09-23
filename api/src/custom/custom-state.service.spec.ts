import { AppException } from '../common/errors.js';
import type { CustomStatus } from '../generated/prisma/enums.js';
import { CustomStateService } from './custom-state.service.js';

interface Row { id: string; number: string; title: string; status: CustomStatus; courier: string | null; awb: string | null; user: { email: string; name: string } }
interface Ev { id: string; requestId: string; status: string; note?: string; photo?: string; actorId?: string; at: Date }
interface Q { id: string; requestId: string; status: string; price: number; depositPct: number; counterAmount: number | null; createdAt: Date }

/** Just enough of the Prisma transaction client for CustomStateService, backed by plain objects. */
function harness(status: CustomStatus = 'REQUESTED') {
  const row: Row = { id: 'r1', number: 'WO-001', title: 'Graduation bear', status, courier: null, awb: null, user: { email: 'maya@example.com', name: 'Maya Iyer' } };
  const events: Ev[] = [];
  const quotes: Q[] = [];
  let racing = false;
  const tx = {
    customRequest: {
      findUnique: async () => ({ ...row }),
      updateMany: async ({ where, data }: { where: { id: string; status: CustomStatus }; data: Partial<Row> }) => {
        if (racing || row.status !== where.status) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    customEvent: {
      create: async ({ data }: { data: Omit<Ev, 'id'> }) => {
        const ev = { ...data, id: `e${events.length + 1}` };
        events.push(ev);
        return ev;
      },
    },
    quote: { findFirst: async () => [...quotes].reverse().find((q) => ['SENT', 'COUNTERED', 'ACCEPTED'].includes(q.status)) ?? null },
  };
  const send = vi.fn(async () => undefined);
  const prisma = { $transaction: async <T>(fn: (t: typeof tx) => Promise<T>) => fn(tx) };
  const config = { get: () => 'http://localhost:3000,https://shop.example' };
  const settings = { getStoreSettings: async () => ({ email: 'maker@example.com' }) };
  const svc = new CustomStateService(prisma as never, { send } as never, config as never, settings as never);
  return { svc, tx, row, events, quotes, send, race: () => (racing = true) };
}

describe('CustomStateService', () => {
  it('walks the full happy path, writing one event per hop and the right emails', async () => {
    const h = harness('REQUESTED');
    h.quotes.push({ id: 'q1', requestId: 'r1', status: 'SENT', price: 1850, depositPct: 50, counterAmount: null, createdAt: new Date() });

    await h.svc.transition('r1', 'UNDER_REVIEW', { note: 'Looking at your idea.' });
    await h.svc.transition('r1', 'QUOTED');
    h.quotes[0].status = 'COUNTERED';
    h.quotes[0].counterAmount = 1600;
    await h.svc.transition('r1', 'COUNTERED');
    h.quotes[0].status = 'DECLINED';
    h.quotes.push({ id: 'q2', requestId: 'r1', status: 'SENT', price: 1700, depositPct: 50, counterAmount: null, createdAt: new Date() });
    await h.svc.transition('r1', 'QUOTED');
    h.quotes[1].status = 'ACCEPTED';
    await h.svc.withTransaction(async (tx, collect) => {
      collect(await h.svc.move(tx as never, 'r1', [{ to: 'ACCEPTED', note: 'Quote accepted' }, { to: 'DEPOSIT_PENDING', note: 'Deposit due' }]));
    });
    await h.svc.transition('r1', 'IN_PROGRESS', { note: 'Deposit received' });
    await h.svc.transition('r1', 'AWAITING_APPROVAL');
    await h.svc.transition('r1', 'IN_PROGRESS', { eventStatus: 'CHANGE_REQUESTED', note: 'Make the tassel gold', notify: false });
    await h.svc.transition('r1', 'AWAITING_APPROVAL');
    await h.svc.transition('r1', 'BALANCE_PENDING');
    await h.svc.transition('r1', 'READY_TO_SHIP', { notify: false });
    await h.svc.transition('r1', 'SHIPPED', { data: { courier: 'Delhivery', awb: 'DL123' } });
    await h.svc.transition('r1', 'DELIVERED', { notify: false });

    expect(h.row.status).toBe('DELIVERED');
    expect(h.row.courier).toBe('Delhivery');
    expect(h.events.map((e) => e.status)).toEqual([
      'UNDER_REVIEW', 'QUOTED', 'COUNTERED', 'QUOTED', 'ACCEPTED', 'DEPOSIT_PENDING', 'IN_PROGRESS', 'AWAITING_APPROVAL',
      'CHANGE_REQUESTED', 'AWAITING_APPROVAL', 'BALANCE_PENDING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED',
    ]);
    // the two hops of one transaction keep a strict order
    const times = h.events.map((e) => e.at.getTime());
    expect(times.slice(4, 6)[0]).toBeLessThan(times[5]);

    const sent = h.send.mock.calls.map((c) => (c as unknown as [string])[0]);
    expect(sent).toEqual([
      'workorder.quoted', 'workorder.countered', 'workorder.quoted', 'workorder.accepted', 'workorder.deposit_paid',
      'workorder.awaiting_approval', 'workorder.awaiting_approval', 'workorder.balance_due', 'workorder.shipped',
    ]);
  });

  it('puts the right amounts and links in the emails', async () => {
    const h = harness('QUOTED');
    h.quotes.push({ id: 'q1', requestId: 'r1', status: 'COUNTERED', price: 1850, depositPct: 50, counterAmount: 1600, createdAt: new Date() });
    await h.svc.transition('r1', 'COUNTERED');
    // a counter-offer is news for the maker: it goes to the store email with an admin link
    expect(h.send).toHaveBeenLastCalledWith('workorder.countered', expect.objectContaining({ to: 'maker@example.com', amount: 1600, url: 'http://localhost:3000/admin/custom/WO-001' }));

    const h2 = harness('QUOTED');
    h2.quotes.push({ id: 'q1', requestId: 'r1', status: 'ACCEPTED', price: 1851, depositPct: 50, counterAmount: null, createdAt: new Date() });
    await h2.svc.withTransaction(async (tx, collect) => {
      collect(await h2.svc.move(tx as never, 'r1', [{ to: 'ACCEPTED' }, { to: 'DEPOSIT_PENDING' }]));
    });
    expect(h2.send).toHaveBeenCalledTimes(1);
    expect(h2.send).toHaveBeenCalledWith('workorder.accepted', expect.objectContaining({ to: 'maya@example.com', amount: 926, url: 'http://localhost:3000/account/custom/WO-001' }));
  });

  it.each<[CustomStatus, CustomStatus]>([
    ['REQUESTED', 'DEPOSIT_PENDING'],
    ['QUOTED', 'IN_PROGRESS'],
    ['IN_PROGRESS', 'BALANCE_PENDING'],
    ['READY_TO_SHIP', 'DELIVERED'],
    ['DELIVERED', 'REQUESTED'],
    ['DECLINED', 'QUOTED'],
    ['CANCELLED', 'ACCEPTED'],
  ])('rejects %s -> %s with 409 and writes nothing', async (from, to) => {
    const h = harness(from);
    const err = await h.svc.transition('r1', to).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppException);
    expect((err as AppException).getStatus()).toBe(409);
    expect((err as AppException).code).toBe('INVALID_TRANSITION');
    expect(h.row.status).toBe(from);
    expect(h.events).toHaveLength(0);
    expect(h.send).not.toHaveBeenCalled();
  });

  it('refuses a whole path when a later hop is illegal (first hop is not applied by the state check)', async () => {
    const h = harness('QUOTED');
    await expect(h.svc.withTransaction((tx) => h.svc.move(tx as never, 'r1', [{ to: 'ACCEPTED' }, { to: 'IN_PROGRESS' }]))).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });

  it('loses gracefully when two requests race on the same work order', async () => {
    const h = harness('QUOTED');
    h.race();
    const err = await h.svc.transition('r1', 'ACCEPTED').catch((e: unknown) => e);
    expect((err as AppException).getStatus()).toBe(409);
    expect((err as AppException).code).toBe('CONFLICT');
    expect(h.events).toHaveLength(0);
  });

  it('404s on an unknown work order', async () => {
    const h = harness();
    h.tx.customRequest.findUnique = async () => null as never;
    await expect(h.svc.transition('nope', 'UNDER_REVIEW')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('record() adds a timeline entry without touching the status', async () => {
    const h = harness('IN_PROGRESS');
    await h.svc.withTransaction(async (tx, collect) => {
      collect(await h.svc.record(tx as never, 'r1', { eventStatus: 'IN_PROGRESS', note: 'Penguin one done', photo: '/uploads/p.jpg', notify: 'workorder.progress' }));
    });
    expect(h.row.status).toBe('IN_PROGRESS');
    expect(h.events).toEqual([expect.objectContaining({ status: 'IN_PROGRESS', photo: '/uploads/p.jpg' })]);
    expect(h.send).toHaveBeenCalledWith('workorder.progress', expect.objectContaining({ note: 'Penguin one done' }));
  });
});
