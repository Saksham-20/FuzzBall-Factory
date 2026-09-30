import request from 'supertest';
import { AuthService } from '../src/auth/auth.service.js';
import { bootApp, makeUser, PASSWORD, type TestApp, type TestUser } from './helpers/e2e.js';

/**
 * Email verification, email change and signup takeover. Auth routes are throttled at 5/min/IP per route, so most setup
 * goes through AuthService directly and HTTP is kept for the calls under test.
 */
describe('email verification and account protection (e2e)', () => {
  let t: TestApp;
  let auth: AuthService;
  const stamp = Date.now();
  const emails: string[] = [];
  const userIds: string[] = [];
  const email = (label: string) => {
    const e = `ver-${label}-${stamp}@example.com`;
    emails.push(e);
    return e;
  };
  const tokenFrom = (url: string) => new URL(url).searchParams.get('token')!;
  const lastLink = (event: string, to: string, key: string) => {
    const hit = [...t.sent].reverse().find((s) => s.event === event && s.payload.to === to);
    expect(hit, `${event} to ${to}`).toBeDefined();
    return tokenFrom(hit!.payload[key] as string);
  };
  const signup = async (label: string, over: Record<string, unknown> = {}) => {
    const e = (over.email as string | undefined) ?? email(label);
    const res = await auth.signup({ name: `Ver ${label}`, email: e, password: PASSWORD, ...over } as never, {});
    userIds.push(res.user.id);
    return { ...res, email: e };
  };

  beforeAll(async () => {
    t = await bootApp();
    auth = t.app.get(AuthService);
  });
  afterAll(async () => {
    await t.prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
    await t.prisma.user.deleteMany({ where: { OR: [{ email: { in: emails } }, { id: { in: userIds } }] } });
    await t.app.close();
  });

  describe('verifying the address', () => {
    it('signup sends a link; using it verifies once; garbage and reuse are refused', async () => {
      const e = email('http');
      const res = await request(t.app.getHttpServer()).post('/auth/signup').send({ name: 'Ver Http', email: e, password: PASSWORD }).expect(201);
      userIds.push(res.body.id);
      expect(res.body.emailVerified).toBe(false);
      const token = lastLink('auth.verify_email', e, 'verifyUrl');

      const ok = await request(t.app.getHttpServer()).post('/auth/verify-email').send({ token }).expect(200);
      expect(ok.body).toEqual({ purpose: 'VERIFY' });
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: res.body.id } })).emailVerified).toBe(true);
      const again = await request(t.app.getHttpServer()).post('/auth/verify-email').send({ token }).expect(400);
      expect(again.body.code).toBe('INVALID_EMAIL_TOKEN');
      await request(t.app.getHttpServer()).post('/auth/verify-email').send({ token: 'x'.repeat(43) }).expect(400);
    });

    it('resend replaces the old link; a verified account gets nothing', async () => {
      const u = await signup('resend');
      const first = lastLink('auth.verify_email', u.email, 'verifyUrl');
      const before = t.sent.length;
      await auth.resendVerification(u.user.id);
      expect(t.sent.length).toBe(before + 1);
      const second = lastLink('auth.verify_email', u.email, 'verifyUrl');
      expect(second).not.toBe(first);
      await expect(auth.verifyEmail(first)).rejects.toMatchObject({ response: { code: 'INVALID_EMAIL_TOKEN' } });
      await expect(auth.verifyEmail(second)).resolves.toEqual({ purpose: 'VERIFY' });

      const sent = t.sent.length;
      await auth.resendVerification(u.user.id);
      expect(t.sent.length).toBe(sent);
    });

    it('an expired link is refused', async () => {
      const u = await signup('expired');
      const token = lastLink('auth.verify_email', u.email, 'verifyUrl');
      await t.prisma.emailToken.updateMany({ where: { userId: u.user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
      await expect(auth.verifyEmail(token)).rejects.toMatchObject({ response: { code: 'INVALID_EMAIL_TOKEN' } });
    });

    it('a password reset proves the inbox, so it verifies the address too', async () => {
      const u = await signup('reset');
      await auth.forgot(u.email);
      const resetToken = lastLink('auth.password_reset', u.email, 'resetUrl');
      await auth.reset(resetToken, 'a-new-password-77');
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: u.user.id } })).emailVerified).toBe(true);
    });
  });

  describe('signup cannot squat an address', () => {
    it('signing up with an unverified, unused account takes it over and signs the old holder out', async () => {
      const squatter = await signup('squat', { name: 'Squatter', password: 'squatter-pass-1' });
      const owner = await auth.signup({ name: 'Real Owner', email: squatter.email, password: 'owner-pass-1234' } as never, {});
      expect(owner.user.id).toBe(squatter.user.id); // same row, new holder
      expect(owner.user.name).toBe('Real Owner');

      await expect(auth.refresh(squatter.tokens.refresh, {})).rejects.toMatchObject({ response: { code: expect.stringMatching(/SESSION_EXPIRED|TOKEN_REUSED/) } });
      await expect(auth.login(squatter.email, 'squatter-pass-1', {})).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
      await expect(auth.login(squatter.email, 'owner-pass-1234', {})).resolves.toBeDefined();
    });

    it('does not take over a verified account, or an unverified one that has history', async () => {
      const verified = await signup('kept');
      await t.prisma.user.update({ where: { id: verified.user.id }, data: { emailVerified: true } });
      await expect(auth.signup({ name: 'X', email: verified.email, password: 'whatever-pass-1' } as never, {})).rejects.toMatchObject({ response: { code: 'EMAIL_TAKEN' } });

      const used = await signup('used');
      await t.prisma.address.create({ data: { userId: used.user.id, label: 'Home', name: 'A', phone: '+919811122233', line1: '12 Test Street', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'IN' } });
      await expect(auth.signup({ name: 'X', email: used.email, password: 'whatever-pass-1' } as never, {})).rejects.toMatchObject({ response: { code: 'EMAIL_TAKEN' } });
      await expect(auth.login(used.email, PASSWORD, {})).resolves.toBeDefined(); // the holder's password still works
    });
  });

  describe('changing phone or email', () => {
    let u: TestUser;
    beforeAll(async () => {
      u = await makeUser(t, 'customer', 'change');
      userIds.push(u.id);
    });

    it('a phone change needs a verified email and the current password', async () => {
      const unverified = await makeUser(t, 'customer', 'unver', { verified: false });
      userIds.push(unverified.id);
      const blocked = await unverified.agent.patch('/account/profile').send({ phone: '9811122255', currentPassword: PASSWORD }).expect(400);
      expect(blocked.body.code).toBe('EMAIL_NOT_VERIFIED');
      await unverified.agent.patch('/account/profile').send({ name: 'Still Can Rename' }).expect(200);

      await u.agent.patch('/account/profile').send({ phone: '9811122255' }).expect(400);
      await u.agent.patch('/account/profile').send({ phone: '9811122255', currentPassword: 'wrong-password' }).expect(400);
      const ok = await u.agent.patch('/account/profile').send({ phone: '9811122255', currentPassword: PASSWORD }).expect(200);
      expect(ok.body.phone).toBe('+919811122255');
      expect(await t.prisma.auditLog.count({ where: { actorId: u.id, action: 'account.phone_change' } })).toBe(1);
    });

    it('the profile route refuses to move the email', async () => {
      const res = await u.agent.patch('/account/profile').send({ email: `other-${stamp}@example.com` }).expect(400);
      expect(res.body.fields.email).toMatch(/Change email/);
      await u.agent.patch('/account/profile').send({ email: u.email }).expect(200);
    });

    it('needs the password, a verified email, and a free address', async () => {
      const target = email('target');
      await u.agent.post('/account/email-change').send({ email: target, password: 'wrong-password' }).expect(400);
      await u.agent.post('/account/email-change').send({ email: u.email, password: PASSWORD }).expect(400);
      const unverified = await makeUser(t, 'customer', 'unver2', { verified: false });
      userIds.push(unverified.id);
      const res = await unverified.agent.post('/account/email-change').send({ email: target, password: PASSWORD }).expect(400);
      expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
      expect(t.sent.some((s) => s.event === 'auth.confirm_email_change' && s.payload.to === target)).toBe(false);
    });

    it('moves only when the new address confirms, then signs every device out', async () => {
      const target = email('moved');
      await u.agent.post('/account/email-change').send({ email: target, password: PASSWORD }).expect(204);
      // the confirm link goes to the NEW address, a notice to the old one
      const token = lastLink('auth.confirm_email_change', target, 'confirmUrl');
      expect(t.sent.some((s) => s.event === 'auth.email_change_notice' && s.payload.to === u.email && s.payload.newEmail === target)).toBe(true);
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).email).toBe(u.email); // nothing yet

      const res = await request(t.app.getHttpServer()).post('/auth/verify-email').send({ token }).expect(200);
      expect(res.body).toEqual({ purpose: 'CHANGE' });
      expect(await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).toMatchObject({ email: target, emailVerified: true });
      await u.agent.get('/auth/me').expect(401); // the old session is gone
      await expect(auth.login(u.email, PASSWORD, {})).rejects.toMatchObject({ response: { code: 'INVALID_CREDENTIALS' } });
      await expect(auth.login(target, PASSWORD, {})).resolves.toBeDefined();
    });

    it('refuses to confirm when someone else took the address in the meantime', async () => {
      const v = await makeUser(t, 'customer', 'race');
      userIds.push(v.id);
      const target = email('raced');
      await v.agent.post('/account/email-change').send({ email: target, password: PASSWORD }).expect(204);
      const token = lastLink('auth.confirm_email_change', target, 'confirmUrl');
      const squatter = await t.prisma.user.create({ data: { name: 'Sq', email: target, passwordHash: 'x', emailVerified: true } });
      userIds.push(squatter.id);
      await expect(auth.verifyEmail(token)).rejects.toMatchObject({ response: { code: 'EMAIL_TAKEN' } });
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: v.id } })).email).toBe(v.email);
    });
  });
});
