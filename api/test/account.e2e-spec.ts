import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import request from 'supertest';
import { makeUser, PASSWORD, type TestUser } from './helpers/e2e.js';
import { bootCommerce, guest, MOCK_PAYMENT_ENV, type CommerceApp } from './helpers/commerce.js';

/** Account (profile, password, addresses, deletion request) and uploads, against the real DB. Users are removed afterwards. */
describe('account and uploads (e2e)', () => {
  let t: CommerceApp;
  let uploadsDir: string;
  const users: TestUser[] = [];
  const address = { label: 'Home', name: 'A Tester', phone: '9811122233', line1: '12 Test Street', city: 'Bengaluru', state: 'Karnataka', postalCode: '560038', country: 'IN' };

  beforeAll(async () => {
    uploadsDir = await mkdtemp(join(tmpdir(), 'fbf-uploads-'));
    t = await bootCommerce({ env: { ...MOCK_PAYMENT_ENV, UPLOADS_DIR: uploadsDir, CLOUDINARY_URL: undefined } });
  });
  afterAll(async () => {
    await t.prisma.auditLog.deleteMany({ where: { actorId: { in: users.map((u) => u.id) } } });
    await t.prisma.user.deleteMany({ where: { id: { in: users.map((u) => u.id) } } });
    t.restoreEnv();
    await t.app.close();
    await rm(uploadsDir, { recursive: true, force: true });
  });

  const newUser = async (label: string) => {
    const u = await makeUser(t, 'customer', label);
    users.push(u);
    return u;
  };

  describe('profile', () => {
    it('GET/PATCH /account/profile returns the web User shape and validates', async () => {
      const u = await newUser('prof');
      const me = await u.agent.get('/account/profile').expect(200);
      expect(me.body).toMatchObject({ id: u.id, email: u.email, role: 'customer' });
      expect(me.body).not.toHaveProperty('passwordHash');
      expect(me.body).not.toHaveProperty('tokenVersion');

      const updated = await u.agent.patch('/account/profile').send({ name: '  New Name ', phone: '98111 22244' }).expect(200);
      expect(updated.body).toMatchObject({ name: 'New Name', phone: '+919811122244', email: u.email });
      await u.agent.patch('/account/profile').send({ phone: '' }).expect(200).expect((r) => expect(r.body).not.toHaveProperty('phone'));
      await u.agent.patch('/account/profile').send({ phone: 'abc' }).expect(400);
      await u.agent.patch('/account/profile').send({ email: 'not-an-email' }).expect(400);
      await u.agent.patch('/account/profile').send({ role: 'admin' }).expect(400); // no privilege escalation
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).role).toBe('customer');
      await guest(t).get('/account/profile').expect(401);
    });

    it('rejects an email or phone that belongs to someone else', async () => {
      const a = await newUser('dup-a');
      const b = await newUser('dup-b');
      await t.prisma.user.update({ where: { id: a.id }, data: { phone: '+919800055501' } });
      const e = await b.agent.patch('/account/profile').send({ email: a.email.toUpperCase() }).expect(409);
      expect(e.body).toMatchObject({ code: 'EMAIL_TAKEN', fields: { email: 'Already registered' } });
      const p = await b.agent.patch('/account/profile').send({ phone: '9800055501' }).expect(409);
      expect(p.body).toMatchObject({ code: 'PHONE_TAKEN' });
      // changing to your own current values is fine
      await a.agent.patch('/account/profile').send({ email: a.email, phone: '9800055501' }).expect(200);
    });
  });

  describe('POST /account/password', () => {
    it('verifies the current password, signs out other sessions, keeps this one alive', async () => {
      const u = await newUser('pw');
      const other = request.agent(t.app.getHttpServer()); // a second device
      await other.post('/auth/login').send({ identifier: u.email, password: PASSWORD }).expect(200);
      await other.get('/auth/me').expect(200);

      await u.agent.post('/account/password').send({ current: 'wrong-password', next: 'brand-new-pass-1' }).expect(400).expect((r) => expect(r.body).toMatchObject({ fields: { current: 'Incorrect' } }));
      await u.agent.post('/account/password').send({ current: PASSWORD, next: 'short' }).expect(400);
      await u.agent.post('/account/password').send({ current: PASSWORD, next: PASSWORD }).expect(400);

      const res = await u.agent.post('/account/password').send({ current: PASSWORD, next: 'brand-new-pass-1' }).expect(204);
      expect((res.headers['set-cookie'] as unknown as string[]).some((c) => c.startsWith('fbf_at='))).toBe(true);
      await u.agent.get('/auth/me').expect(200); // this device stays signed in
      await other.get('/auth/me').expect(401); // the other one is out
      await other.post('/auth/refresh').expect(401);
      await request(t.app.getHttpServer()).post('/auth/login').send({ identifier: u.email, password: PASSWORD }).expect(401);
      await request(t.app.getHttpServer()).post('/auth/login').send({ identifier: u.email, password: 'brand-new-pass-1' }).expect(200);
    });
  });

  describe('addresses', () => {
    it('CRUD with default handling and ownership', async () => {
      const u = await newUser('addr');
      const other = await newUser('addr-other');
      const first = (await u.agent.post('/account/addresses').send(address).expect(201)).body;
      expect(first).toMatchObject({ label: 'Home', isDefault: true, country: 'IN', phone: '+919811122233' }); // first one becomes default
      expect(first).not.toHaveProperty('userId');
      const second = (await u.agent.post('/account/addresses').send({ ...address, label: 'Work', line2: 'Floor 2', isDefault: true }).expect(201)).body;
      expect(second).toMatchObject({ label: 'Work', isDefault: true, line2: 'Floor 2' });
      let list = (await u.agent.get('/account/addresses').expect(200)).body;
      expect(list.map((a: { label: string; isDefault: boolean }) => [a.label, a.isDefault])).toEqual([['Work', true], ['Home', false]]);

      const edited = await u.agent.put(`/account/addresses/${first.id}`).send({ ...address, label: 'Home 2', city: 'Mysuru' }).expect(200);
      expect(edited.body).toMatchObject({ id: first.id, label: 'Home 2', city: 'Mysuru', isDefault: false });
      const promoted = await u.agent.put(`/account/addresses/${first.id}`).send({ ...address, isDefault: true }).expect(200);
      expect(promoted.body.isDefault).toBe(true);
      list = (await u.agent.get('/account/addresses').expect(200)).body;
      expect(list.filter((a: { isDefault: boolean }) => a.isDefault)).toHaveLength(1);

      // others can neither see, edit nor delete it
      expect((await other.agent.get('/account/addresses').expect(200)).body).toEqual([]);
      await other.agent.put(`/account/addresses/${first.id}`).send(address).expect(404);
      await other.agent.delete(`/account/addresses/${first.id}`).expect(204);
      expect((await u.agent.get('/account/addresses').expect(200)).body).toHaveLength(2);

      // deleting the default promotes another
      await u.agent.delete(`/account/addresses/${first.id}`).expect(204);
      list = (await u.agent.get('/account/addresses').expect(200)).body;
      expect(list).toEqual([expect.objectContaining({ id: second.id, isDefault: true })]);
      await u.agent.delete(`/account/addresses/${first.id}`).expect(204); // idempotent
    });

    it('validates addresses (Indian pincode + state, unknown fields, phone)', async () => {
      const u = await newUser('addr-bad');
      const bad = await u.agent.post('/account/addresses').send({ ...address, postalCode: '12', state: 'Narnia' }).expect(400);
      expect(bad.body.fields).toMatchObject({ postalCode: 'Enter a valid 6-digit pincode.', state: 'Pick your state.' });
      await u.agent.post('/account/addresses').send({ ...address, userId: 'someone-else' }).expect(400);
      await u.agent.post('/account/addresses').send({ ...address, phone: 'x' }).expect(400);
      await u.agent.post('/account/addresses').send({ ...address, id: 'abc' }).expect(400);
      await u.agent.post('/account/addresses').send({ ...address, country: 'GB', state: 'England', postalCode: 'N10 2LE' }).expect(201);
    });
  });

  describe('POST /account/delete-request', () => {
    it('records the DPDP request (timestamp + audit row) and stays idempotent', async () => {
      const u = await newUser('del');
      await u.agent.post('/account/delete-request').expect(204);
      const row = await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(row.deletionRequestedAt).toBeTruthy();
      await u.agent.post('/account/delete-request').expect(204);
      expect((await t.prisma.user.findUniqueOrThrow({ where: { id: u.id } })).deletionRequestedAt?.getTime()).toBe(row.deletionRequestedAt!.getTime());
      const audit = await t.prisma.auditLog.findMany({ where: { actorId: u.id, action: 'account.delete_request' } });
      expect(audit).toHaveLength(2);
      expect(audit[0]).toMatchObject({ entity: 'User', entityId: u.id });
      // the account still works: deletion is fulfilled by the maker within 30 days
      await u.agent.get('/auth/me').expect(200);
      await guest(t).post('/account/delete-request').expect(401);
    });
  });

  describe('POST /uploads', () => {
    const png = (w = 64, h = 32) => sharp({ create: { width: w, height: h, channels: 3, background: '#c98586' } }).png().toBuffer();

    it('requires login', async () => {
      await guest(t).post('/uploads').attach('file', await png(), { filename: 'a.png', contentType: 'image/png' }).expect(401);
    });

    it('accepts an image, re-encodes it to WebP (2000px max, EXIF gone) and serves it back', async () => {
      const u = await newUser('up');
      const big = await sharp({ create: { width: 3000, height: 1500, channels: 3, background: '#888' } }).withExif({ IFD0: { Copyright: 'secret-photographer' } }).jpeg().toBuffer();
      const res = await u.agent.post('/uploads').attach('file', big, { filename: 'holiday.jpg', contentType: 'image/jpeg' }).expect(201);
      expect(res.body).toEqual({ url: expect.stringMatching(/^http:\/\/localhost:\d+\/uploads\/uploads\/[0-9a-f-]{36}\.webp$/) });

      const path = new URL(res.body.url as string).pathname;
      const served = await guest(t).get(path).buffer(true).parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
      expect(served.status).toBe(200);
      expect(served.headers['content-type']).toBe('image/webp');
      expect(served.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(served.headers['x-content-type-options']).toBe('nosniff');
      expect(served.headers['cache-control']).toContain('immutable');
      const meta = await sharp(served.body as Buffer).metadata();
      expect(meta).toMatchObject({ format: 'webp', width: 2000, height: 1000 });
      expect(meta.exif).toBeUndefined();
      expect((served.body as Buffer).includes(Buffer.from('secret-photographer'))).toBe(false);
    });

    it('rejects non-images, disguised files, oversize uploads and a missing file', async () => {
      const u = await newUser('up-bad');
      const send = (buf: Buffer, filename: string, contentType: string) => u.agent.post('/uploads').attach('file', buf, { filename, contentType });
      const text = await send(Buffer.from('just text'), 'a.txt', 'text/plain').expect(400);
      expect(text.body).toMatchObject({ code: 'INVALID_IMAGE' });
      await send(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'a.svg', 'image/svg+xml').expect(400);
      const disguised = await send(Buffer.from('<html><script>alert(1)</script></html>'), 'a.jpg', 'image/jpeg').expect(400); // right label, wrong bytes
      expect(disguised.body).toMatchObject({ code: 'INVALID_IMAGE' });
      const huge = await send(Buffer.alloc(9 * 1024 * 1024, 1), 'big.png', 'image/png').expect(413);
      expect(huge.body.code).toBe('PAYLOAD_TOO_LARGE');
      const none = await u.agent.post('/uploads').expect(400);
      expect(none.body.message).toBe('Choose an image to upload.');
    });

    it('serving is locked down: no traversal, only our own file names', async () => {
      await guest(t).get('/uploads/uploads/..%2f..%2fpackage.json').expect(404);
      await guest(t).get('/uploads/uploads/not-a-real-file.webp').expect(404);
      await guest(t).get('/uploads/uploads/00000000-0000-0000-0000-000000000000.webp').expect(404);
      await guest(t).get('/uploads/%2e%2e/x.webp').expect(404);
    });
  });
});
