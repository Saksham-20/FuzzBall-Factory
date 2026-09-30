import { ConfigService } from '@nestjs/config';
import { EmailOutboxService } from '../src/notifications/email-outbox.service.js';
import type { EmailMessage } from '../src/notifications/email.provider.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { bootApp, makeUser, type TestApp, type TestUser } from './helpers/e2e.js';

describe('email outbox (e2e)', () => {
  let t: TestApp;
  let admin: TestUser;
  let customer: TestUser;
  let outbox: EmailOutboxService;
  const made: string[] = [];
  const day = 86_400_000;

  /** Provider whose behaviour the test controls. */
  let mode: 'ok' | 'down' = 'ok';
  let sends: EmailMessage[] = [];
  const provider = {
    send: (m: EmailMessage) => {
      if (mode === 'down') return Promise.reject(new Error('Resend: timeout'));
      sends.push(m);
      return Promise.resolve({ mock: false, id: `re_${sends.length}` });
    },
  };

  beforeAll(async () => {
    t = await bootApp();
    admin = await makeUser(t, 'admin', 'outbox-admin');
    customer = await makeUser(t, 'customer', 'outbox-customer');
    outbox = new EmailOutboxService(t.prisma, provider as never, t.app.get(ConfigService) as never);
  });
  afterAll(async () => {
    await t.prisma.auditLog.deleteMany({ where: { actorId: admin.id } });
    await t.prisma.emailOutbox.deleteMany({ where: { id: { in: made } } });
    await t.prisma.user.deleteMany({ where: { id: { in: [admin.id, customer.id] } } });
    await t.app.close();
  });
  beforeEach(() => {
    mode = 'ok';
    sends = [];
  });

  const welcome = (to = `outbox-${Math.random().toString(36).slice(2, 8)}@example.com`) => ({ to, name: 'Maya' });
  const queue = async (event: 'auth.welcome' | 'auth.password_reset' = 'auth.welcome') => {
    const id = await outbox.enqueue(event as never, (event === 'auth.welcome' ? welcome() : { ...welcome(), resetUrl: 'https://x.test/reset?token=abc', expiresInMinutes: 30 }) as never);
    made.push(id);
    return id;
  };
  const row = (id: string) => t.prisma.emailOutbox.findUniqueOrThrow({ where: { id } });
  const makeDue = (id: string) => t.prisma.emailOutbox.update({ where: { id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });

  it('sends, marks SENT, and empties the payload', async () => {
    const id = await queue();
    expect(await outbox.deliver(id)).toBe('SENT');
    const r = await row(id);
    expect(r).toMatchObject({ status: 'SENT', attempts: 1, providerId: 're_1', lastError: null });
    expect(r.sentAt).not.toBeNull();
    expect(r.payload).toEqual({});
    expect(sends).toHaveLength(1);
    expect(await outbox.deliver(id)).toBe('SKIPPED'); // already done: never sent twice
    expect(sends).toHaveLength(1);
  });

  it('a provider outage queues a retry with backoff, and the scheduler sends it once the provider is back', async () => {
    const id = await queue();
    mode = 'down';
    expect(await outbox.deliver(id)).toBe('RETRY');
    let r = await row(id);
    expect(r).toMatchObject({ status: 'PENDING', attempts: 1, lastError: 'Resend: timeout' });
    expect(r.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(r.payload).not.toEqual({}); // still needed for the retry

    mode = 'ok';
    await outbox.processDue(); // not due yet: nothing happens for this row
    expect((await row(id)).status).toBe('PENDING');
    await makeDue(id);
    await outbox.processDue();
    r = await row(id);
    expect(r).toMatchObject({ status: 'SENT', attempts: 2 });
    expect(sends).toHaveLength(1);
  });

  it('gives up after the last attempt (dead letter), keeping the content for a resend', async () => {
    const id = await queue();
    mode = 'down';
    let result;
    for (let i = 0; i < 6; i += 1) {
      await makeDue(id);
      result = await outbox.deliver(id);
      if (result === 'FAILED') break;
    }
    expect(result).toBe('FAILED');
    const r = await row(id);
    expect(r).toMatchObject({ status: 'FAILED', attempts: 6, lastError: 'Resend: timeout' });
    expect(r.payload).not.toEqual({});
  });

  it('a password-reset email gives up quickly and forgets its link', async () => {
    const id = await queue('auth.password_reset');
    mode = 'down';
    expect(await outbox.deliver(id)).toBe('RETRY');
    await makeDue(id);
    expect(await outbox.deliver(id)).toBe('FAILED');
    expect((await row(id)).payload).toEqual({});
  });

  it('an email whose template cannot render fails at once, no retries', async () => {
    const id = await queue();
    await t.prisma.emailOutbox.update({ where: { id }, data: { event: 'no.such_event' } });
    expect(await outbox.deliver(id)).toBe('FAILED');
    expect((await row(id)).lastError).toMatch(/Could not render/);
    expect(sends).toHaveLength(0);
  });

  it('two workers racing send it once; a dead worker\'s lease is taken over', async () => {
    const id = await queue();
    const results = await Promise.all([outbox.deliver(id), outbox.deliver(id)]);
    expect(results.sort()).toEqual(['SENT', 'SKIPPED']);
    expect(sends).toHaveLength(1);

    const stuck = await queue();
    await t.prisma.emailOutbox.update({ where: { id: stuck }, data: { status: 'SENDING', lockedUntil: new Date(Date.now() + 60_000), attempts: 1 } });
    expect(await outbox.deliver(stuck)).toBe('SKIPPED'); // lease still valid
    await t.prisma.emailOutbox.update({ where: { id: stuck }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    expect(await outbox.deliver(stuck)).toBe('SENT');
  });

  it('NotificationsService queues then sends, and never throws when the provider is down', async () => {
    const notifications = new NotificationsService(outbox);
    const to = `outbox-n-${Date.now()}@example.com`;
    await notifications.send('auth.welcome', { to, name: 'Maya' });
    const sentRow = await t.prisma.emailOutbox.findFirstOrThrow({ where: { toEmail: to } });
    made.push(sentRow.id);
    expect(sentRow.status).toBe('SENT');

    mode = 'down';
    const to2 = `outbox-n2-${Date.now()}@example.com`;
    await expect(notifications.send('auth.welcome', { to: to2, name: 'Maya' })).resolves.toBeUndefined();
    const queued = await t.prisma.emailOutbox.findFirstOrThrow({ where: { toEmail: to2 } });
    made.push(queued.id);
    expect(queued.status).toBe('PENDING');
  });

  describe('admin API', () => {
    it('is admin-only', async () => {
      await customer.agent.get('/admin/email').expect(403);
      await customer.agent.post('/admin/email/whatever/retry').expect(403);
    });

    it('lists dead letters and resends one (audited); refuses what cannot be resent', async () => {
      const failed = await t.prisma.emailOutbox.create({ data: { event: 'auth.welcome', toEmail: welcome().to, payload: welcome(), status: 'FAILED', attempts: 6, lastError: 'Resend: timeout' } });
      const cleared = await t.prisma.emailOutbox.create({ data: { event: 'auth.password_reset', toEmail: welcome().to, payload: {}, status: 'FAILED', attempts: 2, lastError: 'x' } });
      const fresh = await t.prisma.emailOutbox.create({ data: { event: 'auth.welcome', toEmail: welcome().to, payload: welcome(), status: 'PENDING' } });
      made.push(failed.id, cleared.id, fresh.id);

      const list = (await admin.agent.get('/admin/email?status=FAILED').expect(200)).body as { id: string; status: string; resendable: boolean }[];
      expect(list.every((r) => r.status === 'FAILED')).toBe(true);
      expect(list.find((r) => r.id === failed.id)).toMatchObject({ resendable: true });
      expect(list.find((r) => r.id === cleared.id)).toMatchObject({ resendable: false });
      await admin.agent.get('/admin/email?status=NOPE').expect(400);

      const res = await admin.agent.post(`/admin/email/${failed.id}/retry`).expect(200);
      expect(res.body).toMatchObject({ id: failed.id, status: 'SENT', resendable: false });
      expect(await t.prisma.auditLog.count({ where: { actorId: admin.id, action: 'email.retry', entityId: failed.id } })).toBe(1);

      await admin.agent.post(`/admin/email/${cleared.id}/retry`).expect(400);
      await admin.agent.post(`/admin/email/${fresh.id}/retry`).expect(400);
      await admin.agent.post('/admin/email/nope/retry').expect(404);
    });
  });

  it('purges old sent mail and dead letters, keeps recent ones and anything waiting', async () => {
    const { RetentionService } = await import('../src/jobs/retention.service.js');
    const mk = (status: 'SENT' | 'FAILED' | 'PENDING', ageDays: number) =>
      t.prisma.emailOutbox.create({ data: { event: 'auth.welcome', toEmail: welcome().to, payload: {}, status, createdAt: new Date(Date.now() - ageDays * day) } });
    const [oldSent, recentSent, oldFailed, midFailed, oldPending] = await Promise.all([mk('SENT', 40), mk('SENT', 5), mk('FAILED', 100), mk('FAILED', 40), mk('PENDING', 100)]);
    made.push(oldSent.id, recentSent.id, oldFailed.id, midFailed.id, oldPending.id);
    await new RetentionService(t.prisma).purgeEmailOutbox();
    const exists = async (id: string) => (await t.prisma.emailOutbox.findUnique({ where: { id } })) !== null;
    expect([await exists(oldSent.id), await exists(oldFailed.id)]).toEqual([false, false]);
    expect([await exists(recentSent.id), await exists(midFailed.id), await exists(oldPending.id)]).toEqual([true, true, true]);
  });
});
