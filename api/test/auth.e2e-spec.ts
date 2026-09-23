import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

/**
 * Runs against the local dev database (DATABASE_URL). Creates one uniquely-named user and removes it afterwards.
 * Auth routes are throttled at 5/min/IP, so this file deliberately makes at most 4 calls to each of them.
 */
describe('health + auth round trip (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const stamp = Date.now();
  const email = `e2e-${stamp}@example.com`;
  const password = 'correct-horse-9';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('GET /health', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });

  it('rejects unauthenticated /auth/me with the standard error shape', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me').expect(401);
    expect(res.body).toEqual({ code: 'UNAUTHENTICATED', message: expect.any(String) });
  });

  it('signup validates with per-field errors and forbids unknown fields (no role escalation)', async () => {
    const res = await request(app.getHttpServer()).post('/auth/signup').send({ name: '', email: 'nope', password: '1', role: 'admin' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(Object.keys(res.body.fields).sort()).toEqual(['email', 'name', 'password', 'role']);
  });

  it('signup -> me -> refresh -> logout -> login, with httpOnly cookies', async () => {
    const agent = request.agent(app.getHttpServer());

    const signup = await agent.post('/auth/signup').send({ name: 'E2E Tester', email, password }).expect(201);
    expect(signup.body).toMatchObject({ name: 'E2E Tester', email, role: 'customer' });
    expect(signup.body).not.toHaveProperty('passwordHash');
    const cookies = signup.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('fbf_at=') && /HttpOnly/i.test(c) && /SameSite=Lax/i.test(c))).toBe(true);
    expect(cookies.some((c) => c.startsWith('fbf_rt=') && /Path=\/auth/.test(c) && /HttpOnly/i.test(c))).toBe(true);

    await agent.post('/auth/signup').send({ name: 'Dup', email, password }).expect(409).expect((r) => expect(r.body.code).toBe('EMAIL_TAKEN'));

    const me = await agent.get('/auth/me').expect(200);
    expect(me.body.email).toBe(email);

    await agent.post('/auth/refresh').expect(200);
    await agent.get('/auth/me').expect(200);

    await agent.post('/auth/logout').expect(204);
    await agent.get('/auth/me').expect(401);

    await request(app.getHttpServer()).post('/auth/login').send({ identifier: email, password: 'wrong-password' }).expect(401);
    const login = await request(app.getHttpServer()).post('/auth/login').send({ identifier: email.toUpperCase(), password }).expect(200);
    expect(login.body.email).toBe(email);

    // Bearer works for tooling
    const bearer = (login.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('fbf_at='))!.split(';')[0].slice('fbf_at='.length);
    await request(app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${bearer}`).expect(200);
  });

  it('forgot never reveals whether the email exists', async () => {
    const known = await request(app.getHttpServer()).post('/auth/forgot').send({ email }).expect(204);
    const unknown = await request(app.getHttpServer()).post('/auth/forgot').send({ email: `nobody-${stamp}@example.com` }).expect(204);
    expect(known.text).toBe(unknown.text);
  });
});
