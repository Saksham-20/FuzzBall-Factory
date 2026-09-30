import { RetentionService } from '../src/jobs/retention.service.js';
import { bootApp, makeUser, type TestApp } from './helpers/e2e.js';

describe('retention purges (e2e)', () => {
  let t: TestApp;
  let userId: string | undefined;
  const day = 86_400_000;
  beforeAll(async () => {
    t = await bootApp();
  });
  afterAll(async () => {
    if (userId) await t.prisma.user.deleteMany({ where: { id: userId } });
    await t.app.close();
  });

  it('drops long-expired auth tokens and keeps recent and live ones', async () => {
    const user = await makeUser(t, 'customer', 'retention');
    userId = user.id;
    const mk = (name: string, ageDays: number) =>
      t.prisma.refreshToken.create({ data: { userId: user.id, familyId: `fam-${name}`, tokenHash: `h-${name}-${Date.now()}`, expiresAt: new Date(Date.now() - ageDays * day) } });
    const old = await mk('old', 30);
    const recent = await mk('recent', 2);
    const live = await mk('live', -10);
    const oldReset = await t.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: `r-old-${Date.now()}`, expiresAt: new Date(Date.now() - 30 * day) } });
    const liveReset = await t.prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: `r-live-${Date.now()}`, expiresAt: new Date(Date.now() + day) } });

    const counts = await t.app.get(RetentionService).purgeAuthTokens();
    expect(counts.refresh).toBeGreaterThanOrEqual(1);
    expect(counts.reset).toBeGreaterThanOrEqual(1);
    expect(await t.prisma.refreshToken.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await t.prisma.refreshToken.findUnique({ where: { id: recent.id } })).not.toBeNull();
    expect(await t.prisma.refreshToken.findUnique({ where: { id: live.id } })).not.toBeNull();
    expect(await t.prisma.passwordResetToken.findUnique({ where: { id: oldReset.id } })).toBeNull();
    expect(await t.prisma.passwordResetToken.findUnique({ where: { id: liveReset.id } })).not.toBeNull();
  });

  it('drops old processed webhook events but keeps failed, unprocessed and recent ones', async () => {
    const tag = `evt-${Date.now()}`;
    const mk = (n: string, ageDays: number, extra: { processedAt?: Date | null; error?: string }) =>
      t.prisma.webhookEvent.create({ data: { eventId: `${tag}-${n}`, type: 'payment.captured', payload: {}, receivedAt: new Date(Date.now() - ageDays * day), ...extra } });
    const oldDone = await mk('done', 120, { processedAt: new Date() });
    const oldFailed = await mk('failed', 120, { processedAt: new Date(), error: 'amount mismatch' });
    const oldPending = await mk('pending', 120, { processedAt: null });
    const recent = await mk('recent', 5, { processedAt: new Date() });

    expect(await t.app.get(RetentionService).purgeWebhookEvents()).toBeGreaterThanOrEqual(1);
    expect(await t.prisma.webhookEvent.findUnique({ where: { id: oldDone.id } })).toBeNull();
    for (const kept of [oldFailed, oldPending, recent]) expect(await t.prisma.webhookEvent.findUnique({ where: { id: kept.id } })).not.toBeNull();
    await t.prisma.webhookEvent.deleteMany({ where: { eventId: { startsWith: tag } } });
  });
});
