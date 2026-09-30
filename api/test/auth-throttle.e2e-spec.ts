import { AuthService } from '../src/auth/auth.service.js';
import { AuthThrottleService, LOGIN_POLICY, TRACK_POLICY } from '../src/common/auth-throttle.service.js';
import { OrdersService } from '../src/orders/orders.service.js';
import { bootApp, makeUser, PASSWORD, type TestApp } from './helpers/e2e.js';

describe('persistent guess limits (e2e)', () => {
  let t: TestApp;
  let auth: AuthService;
  let throttle: AuthThrottleService;
  const keys: string[] = [];
  const userIds: string[] = [];
  const stamp = Date.now();

  beforeAll(async () => {
    t = await bootApp();
    auth = t.app.get(AuthService);
    throttle = t.app.get(AuthThrottleService);
  });
  afterAll(async () => {
    await t.prisma.authThrottle.deleteMany({ where: { key: { in: keys } } });
    await t.prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await t.app.close();
  });

  const row = (key: string) => t.prisma.authThrottle.findUnique({ where: { key } });
  const wrong = (email: string, times: number) => (async () => {
    for (let i = 0; i < times; i += 1) await expect(auth.login(email, 'nope-nope-1', {})).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
  })();

  it('locks an account after five wrong passwords, even for the right password, then lifts', async () => {
    const u = await makeUser(t, 'customer', 'lock');
    userIds.push(u.id);
    const key = `login:${u.email}`;
    keys.push(key);

    await wrong(u.email, 5);
    expect((await row(key))?.failures).toBe(5);
    await expect(auth.login(u.email, PASSWORD, {})).rejects.toMatchObject({ response: { code: 'RATE_LIMITED' } });
    await expect(auth.login(u.email.toUpperCase(), PASSWORD, {})).rejects.toMatchObject({ response: { code: 'RATE_LIMITED' } }); // same account, any case

    await t.prisma.authThrottle.update({ where: { key }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    await expect(auth.login(u.email, PASSWORD, {})).resolves.toBeDefined();
    expect(await row(key)).toBeNull(); // success clears the counter
  });

  it('four wrong tries then the right password is fine; failures outside the window are forgotten', async () => {
    const u = await makeUser(t, 'customer', 'window');
    userIds.push(u.id);
    const key = `login:${u.email}`;
    keys.push(key);
    await wrong(u.email, 4);
    await expect(auth.login(u.email, PASSWORD, {})).resolves.toBeDefined();

    await wrong(u.email, 4);
    await t.prisma.authThrottle.update({ where: { key }, data: { windowStart: new Date(Date.now() - LOGIN_POLICY.windowMs - 1000) } });
    await wrong(u.email, 1); // the old four expire: this is failure #1 of a fresh window
    expect((await row(key))?.failures).toBe(1);
  });

  it('an unknown account locks the same way, so the lock reveals nothing', async () => {
    const ghost = `ghost-${stamp}@example.com`;
    keys.push(`login:${ghost}`);
    await wrong(ghost, 5);
    await expect(auth.login(ghost, 'anything-1234', {})).rejects.toMatchObject({ response: { code: 'RATE_LIMITED' } });
  });

  it('a password reset (proof of the inbox) lifts the lock', async () => {
    const u = await makeUser(t, 'customer', 'reset-lock');
    userIds.push(u.id);
    keys.push(`login:${u.email}`);
    await wrong(u.email, 5);
    await expect(auth.login(u.email, PASSWORD, {})).rejects.toMatchObject({ response: { code: 'RATE_LIMITED' } });
    await auth.forgot(u.email);
    const link = [...t.sent].reverse().find((s) => s.event === 'auth.password_reset' && s.payload.to === u.email)!;
    await auth.reset(new URL(link.payload.resetUrl as string).searchParams.get('token')!, 'fresh-password-42');
    await expect(auth.login(u.email, 'fresh-password-42', {})).resolves.toBeDefined();
  });

  it('counts concurrent failures exactly (atomic upsert)', async () => {
    const key = `test:concurrent-${stamp}`;
    keys.push(key);
    await Promise.all(Array.from({ length: 8 }, () => throttle.recordFailure(key, { maxFailures: 100, windowMs: 60_000, lockMs: 60_000 })));
    expect((await row(key))?.failures).toBe(8);
  });

  it('caps guesses against one order number on the public tracker', async () => {
    const orders = t.app.get(OrdersService);
    const number = `FB-9${stamp}`.slice(0, 20);
    keys.push(`track:${number}`);
    for (let i = 0; i < TRACK_POLICY.maxFailures; i += 1) await expect(orders.track(number, `guess${i}@example.com`)).rejects.toMatchObject({ response: { code: 'NOT_FOUND' } });
    await expect(orders.track(number, 'another@example.com')).rejects.toMatchObject({ response: { code: 'RATE_LIMITED' } });
  });
});
