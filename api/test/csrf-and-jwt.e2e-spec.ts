import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ACCESS_AUDIENCE, JWT_ISSUER } from '../src/auth/token.service.js';
import { bootApp, makeUser, type TestApp, type TestUser } from './helpers/e2e.js';

describe('CSRF origin guard and JWT pinning (e2e)', () => {
  let t: TestApp;
  let u: TestUser;
  let origin: string;
  beforeAll(async () => {
    t = await bootApp();
    u = await makeUser(t, 'customer', 'csrf');
    origin = t.app.get(ConfigService).get<string>('WEB_ORIGIN')!.split(',')[0]!.trim();
  });
  afterAll(async () => {
    await t.prisma.user.deleteMany({ where: { id: u.id } });
    await t.app.close();
  });

  it('refuses a cookie-carrying write from another site, answers our own site, and never blocks reads', async () => {
    const evil = await u.agent.post('/auth/logout').set('Origin', 'https://evil.example').expect(403);
    expect(evil.body.code).toBe('FORBIDDEN');
    await u.agent.get('/auth/me').expect(200); // the forged logout did nothing

    await u.agent.get('/auth/me').set('Origin', 'https://evil.example').expect(200); // reads are CORS's business
    await u.agent.post('/auth/logout').set('Origin', origin).expect(204);
    await u.agent.get('/auth/me').expect(401);
  });

  it('a write with no Origin (server to server) is not blocked', async () => {
    await request(t.app.getHttpServer()).post('/auth/logout').expect(204);
  });

  it('rejects access tokens that lack our issuer/audience, are unsigned, or use another algorithm', async () => {
    const fresh = await makeUser(t, 'customer', 'jwt');
    try {
      const jwt = new JwtService();
      const secret = t.app.get(ConfigService).get<string>('JWT_ACCESS_SECRET')!;
      const claims = { sub: fresh.id, role: 'customer', tv: 0 };
      const me = (token: string) => request(t.app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${token}`);

      await me(await jwt.signAsync(claims, { secret, issuer: JWT_ISSUER, audience: ACCESS_AUDIENCE })).expect(200); // the shape the API itself issues
      await me(await jwt.signAsync(claims, { secret })).expect(401); // no issuer/audience
      await me(await jwt.signAsync(claims, { secret, issuer: 'someone-else', audience: ACCESS_AUDIENCE })).expect(401);
      await me(await jwt.signAsync(claims, { secret, issuer: JWT_ISSUER, audience: 'fuzzball-refresh' })).expect(401); // a refresh-audience token
      await me(await jwt.signAsync(claims, { secret, algorithm: 'HS512', issuer: JWT_ISSUER, audience: ACCESS_AUDIENCE })).expect(401);
      const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
      await me(`${b64({ alg: 'none', typ: 'JWT' })}.${b64({ ...claims, iss: JWT_ISSUER, aud: ACCESS_AUDIENCE })}.`).expect(401);
    } finally {
      await t.prisma.user.deleteMany({ where: { id: fresh.id } });
    }
  });
});
