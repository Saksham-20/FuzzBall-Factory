import { RetentionService } from '../src/jobs/retention.service.js';
import { bootApp, makeUser, type TestApp, type TestUser } from './helpers/e2e.js';

interface Page {
  items: { id: string; at: string; actor: { id: string; email: string } | null; action: string; entity: string; entityId: string | null; ip: string | null }[];
  nextCursor?: string;
}

describe('admin audit log (e2e)', () => {
  let t: TestApp;
  let admin: TestUser;
  let customer: TestUser;
  const tag = `e2e-audit-${Date.now()}`;

  beforeAll(async () => {
    t = await bootApp();
    admin = await makeUser(t, 'admin', 'audit-admin');
    customer = await makeUser(t, 'customer', 'audit-customer');
    // Five rows one second apart, so the order is unambiguous.
    for (let i = 0; i < 5; i += 1) {
      await t.prisma.auditLog.create({
        data: { actorId: admin.id, action: i % 2 === 0 ? `${tag}.even` : `${tag}.odd`, entity: 'Probe', entityId: `${tag}-${i}`, ip: '203.0.113.9', createdAt: new Date(Date.now() - (5 - i) * 1000) },
      });
    }
  });
  afterAll(async () => {
    await t.prisma.auditLog.deleteMany({ where: { OR: [{ entity: 'Probe', entityId: { startsWith: tag } }, { actorId: { in: [admin.id, customer.id] } }] } });
    await t.prisma.user.deleteMany({ where: { id: { in: [admin.id, customer.id] } } });
    await t.app.close();
  });

  it('is admin-only', async () => {
    await customer.agent.get('/admin/audit').expect(403);
  });

  it('lists newest first with the actor, and filters by action, entity, entityId and actor', async () => {
    const all = (await admin.agent.get('/admin/audit').query({ entity: 'Probe', actorId: admin.id }).expect(200)).body as Page;
    expect(all.items.map((r) => r.entityId)).toEqual([4, 3, 2, 1, 0].map((i) => `${tag}-${i}`));
    expect(all.items[0]).toMatchObject({ action: `${tag}.even`, entity: 'Probe', ip: '203.0.113.9', actor: { id: admin.id, email: admin.email } });
    expect(all.nextCursor).toBeUndefined();

    const even = (await admin.agent.get('/admin/audit').query({ action: `${tag}.even` }).expect(200)).body as Page;
    expect(even.items.map((r) => r.entityId)).toEqual([4, 2, 0].map((i) => `${tag}-${i}`));
    const one = (await admin.agent.get('/admin/audit').query({ entity: 'Probe', entityId: `${tag}-3` }).expect(200)).body as Page;
    expect(one.items).toHaveLength(1);
  });

  it('pages with a cursor and rejects a bad one or a bad limit', async () => {
    const q = { entity: 'Probe', actorId: admin.id, limit: 2 };
    const p1 = (await admin.agent.get('/admin/audit').query(q).expect(200)).body as Page;
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).toBe(p1.items[1]!.id);
    const p2 = (await admin.agent.get('/admin/audit').query({ ...q, before: p1.nextCursor }).expect(200)).body as Page;
    expect(p2.items.map((r) => r.entityId)).toEqual([2, 1].map((i) => `${tag}-${i}`));
    const p3 = (await admin.agent.get('/admin/audit').query({ ...q, before: p2.nextCursor }).expect(200)).body as Page;
    expect(p3.items.map((r) => r.entityId)).toEqual([`${tag}-0`]);
    expect(p3.nextCursor).toBeUndefined();

    await admin.agent.get('/admin/audit').query({ before: 'nope' }).expect(400);
    await admin.agent.get('/admin/audit').query({ limit: 101 }).expect(400);
  });

  it('forgets IPs older than the retention window but keeps the row', async () => {
    const old = await t.prisma.auditLog.create({ data: { actorId: admin.id, action: `${tag}.old`, entity: 'Probe', entityId: `${tag}-old`, ip: '198.51.100.7', createdAt: new Date(Date.now() - 120 * 86_400_000) } });
    await new RetentionService(t.prisma).scrubAuditIps();
    expect(await t.prisma.auditLog.findUniqueOrThrow({ where: { id: old.id } })).toMatchObject({ ip: null, action: `${tag}.old` });
    const recent = await t.prisma.auditLog.findFirstOrThrow({ where: { entityId: `${tag}-4` } });
    expect(recent.ip).toBe('203.0.113.9');
  });
});
