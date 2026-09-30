import request from 'supertest';
import { bootApp, makeUser, PASSWORD, type TestApp } from './helpers/e2e.js';

describe('concurrent refresh (e2e)', () => {
  let t: TestApp;
  let userId: string;
  let email: string;
  beforeAll(async () => {
    t = await bootApp();
    const u = await makeUser(t, 'customer', 'race');
    userId = u.id;
    email = u.email;
  });
  afterAll(async () => {
    await t.prisma.user.deleteMany({ where: { id: userId } });
    await t.app.close();
  });

  const cookiesOf = (res: request.Response) => (res.headers['set-cookie'] as unknown as string[]).map((c) => c.split(';')[0]!);
  const isCleared = (res: request.Response) => ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? []).some((c) => /=;|Expires=Thu, 01 Jan 1970/i.test(c));

  it('two tabs refreshing with the same cookie both end up signed in, and nobody is signed out', async () => {
    const login = await request(t.app.getHttpServer()).post('/auth/login').send({ identifier: email, password: PASSWORD }).expect(200);
    const cookie = cookiesOf(login).join('; ');

    const results = await Promise.all([1, 2, 3].map(() => request(t.app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie)));
    const ok = results.filter((r) => r.status === 200);
    const raced = results.filter((r) => r.status === 409);
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(ok.length + raced.length).toBe(3); // nothing else: no 401
    for (const r of raced) {
      expect(r.body.code).toBe('REFRESH_RACE');
      expect(isCleared(r)).toBe(false); // the browser keeps the newer cookie
    }
    // whichever cookie set came back last still works
    const newest = cookiesOf(ok[ok.length - 1]!).join('; ');
    await request(t.app.getHttpServer()).post('/auth/refresh').set('Cookie', newest).expect(200);
  });

  it('a genuinely stale token is still refused (and clears the cookies)', async () => {
    const login = await request(t.app.getHttpServer()).post('/auth/login').send({ identifier: email, password: PASSWORD }).expect(200);
    const cookie = cookiesOf(login).join('; ');
    await request(t.app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(200);
    await t.prisma.refreshToken.updateMany({ where: { userId, replacedById: { not: null } }, data: { revokedAt: new Date(Date.now() - 60_000) } });
    const res = await request(t.app.getHttpServer()).post('/auth/refresh').set('Cookie', cookie).expect(401);
    expect(res.body.code).toBe('TOKEN_REUSED');
    expect(isCleared(res)).toBe(true);
  });
});
