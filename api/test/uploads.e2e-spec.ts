import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { UPLOADS_PER_DAY, UploadsService } from '../src/uploads/uploads.service.js';
import { makeUser, type TestUser } from './helpers/e2e.js';
import { bootCommerce, MOCK_PAYMENT_ENV, type CommerceApp } from './helpers/commerce.js';

describe('uploads: ownership, quota, allow-list, orphan cleanup (e2e)', () => {
  let t: CommerceApp;
  let dir: string;
  let uploads: UploadsService;
  let maya: TestUser;
  let other: TestUser;
  let admin: TestUser;
  let category: string;
  const created: string[] = [];
  const png = () => sharp({ create: { width: 40, height: 40, channels: 3, background: '#c98586' } }).png().toBuffer();

  const upload = async (who: TestUser) => {
    const res = await who.agent.post('/uploads').attach('file', await png(), { filename: 'a.png', contentType: 'image/png' }).expect(201);
    return res.body.url as string;
  };
  const workOrder = (references: string[]) => ({
    kind: 'NEW', category, title: 'Upload rules bear', description: 'A small crochet bear for testing upload ownership, about 15 cm, cream.',
    colours: ['Cream'], size: 'About 15 cm', quantity: 1, budgetMin: 800, budgetMax: 1200, neededBy: '', occasion: 'Test', personalization: '',
    references, country: 'IN', postalCode: '560038', phone: '98765 43210',
  });

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'fbf-upl-'));
    t = await bootCommerce({ env: { ...MOCK_PAYMENT_ENV, UPLOADS_DIR: dir, CLOUDINARY_URL: undefined } });
    uploads = t.app.get(UploadsService);
    category = (await t.prisma.category.findFirstOrThrow()).slug;
    [maya, other, admin] = [await makeUser(t, 'customer', 'upl-maya'), await makeUser(t, 'customer', 'upl-other'), await makeUser(t, 'admin', 'upl-admin')];
  });
  afterAll(async () => {
    await t.prisma.customRequest.deleteMany({ where: { number: { in: created } } });
    await t.prisma.upload.deleteMany({ where: { userId: { in: [maya.id, other.id, admin.id] } } });
    await t.prisma.auditLog.deleteMany({ where: { actorId: { in: [maya.id, other.id, admin.id] } } });
    await t.prisma.user.deleteMany({ where: { id: { in: [maya.id, other.id, admin.id] } } });
    t.restoreEnv();
    await t.app.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('records who uploaded a file; the maker\'s uploads count as in use, a customer\'s wait to be attached', async () => {
    const mine = await upload(maya);
    const makers = await upload(admin);
    expect(await t.prisma.upload.findUniqueOrThrow({ where: { url: mine } })).toMatchObject({ userId: maya.id, attachedAt: null });
    expect(await t.prisma.upload.findUniqueOrThrow({ where: { url: makers } })).toMatchObject({ userId: admin.id, attachedAt: expect.any(Date) });
  });

  it('a work order may only use photos its owner uploaded, and using them marks them attached', async () => {
    const mine = await upload(maya);
    const theirs = await upload(other);

    const stolen = await maya.agent.post('/custom').send(workOrder([theirs])).expect(400);
    expect(stolen.body.fields.references).toMatch(/uploaded/);
    await maya.agent.post('/custom').send(workOrder(['https://evil.example/pixel.gif'])).expect(400);
    await maya.agent.post('/custom').send(workOrder(['/uploads/uploads/00000000-0000-0000-0000-000000000000.webp'])).expect(400); // never uploaded

    const ok = await maya.agent.post('/custom').send(workOrder([mine])).expect(201);
    created.push(ok.body.number);
    expect(ok.body.references).toEqual([mine]);
    expect((await t.prisma.upload.findUniqueOrThrow({ where: { url: mine } })).attachedAt).not.toBeNull();
    expect((await t.prisma.upload.findUniqueOrThrow({ where: { url: theirs } })).attachedAt).toBeNull(); // untouched by the rejected attempts

    // the same rule for message attachments
    const msg = (attachments: string[]) => maya.agent.post(`/custom/${ok.body.number}/messages`).send({ body: 'Here is another idea', attachments });
    await msg([theirs]).expect(400);
    const second = await upload(maya);
    await msg([second]).expect(200);
    expect((await t.prisma.upload.findUniqueOrThrow({ where: { url: second } })).attachedAt).not.toBeNull();
  });

  it('caps a customer\'s uploads per day but not the maker\'s', async () => {
    const heavy = await makeUser(t, 'customer', 'upl-heavy');
    try {
      await t.prisma.upload.createMany({ data: Array.from({ length: UPLOADS_PER_DAY }, (_, i) => ({ userId: heavy.id, url: `https://quota.test/${heavy.id}-${i}.webp`, key: `uploads/quota-${i}` })) });
      const res = await heavy.agent.post('/uploads').attach('file', await png(), { filename: 'a.png', contentType: 'image/png' }).expect(429);
      expect(res.body.code).toBe('RATE_LIMITED');
      // yesterday's uploads no longer count
      await t.prisma.upload.updateMany({ where: { userId: heavy.id }, data: { createdAt: new Date(Date.now() - 2 * 86_400_000) } });
      await heavy.agent.post('/uploads').attach('file', await png(), { filename: 'a.png', contentType: 'image/png' }).expect(201);

      await t.prisma.upload.createMany({ data: Array.from({ length: UPLOADS_PER_DAY }, (_, i) => ({ userId: admin.id, url: `https://quota.test/${admin.id}-${i}.webp`, key: `uploads/quota-a-${i}` })) });
      await upload(admin);
    } finally {
      await t.prisma.upload.deleteMany({ where: { userId: heavy.id } });
      await t.prisma.user.deleteMany({ where: { id: heavy.id } });
    }
  });

  describe('maker image fields only accept our own storage', () => {
    it.each([
      ['https://evil.example/x.jpg', false],
      ['http://localhost/uploads/../../etc/passwd', false],
      ['javascript:alert(1)', false],
      ['//evil.example/uploads/x.jpg', false],
      ['/uploads/uploads/abc.webp', true],
      ['/samples/bear.jpg', true], // development only: the web app's own sample photos
    ])('%s -> %s', (url, allowed) => {
      expect(uploads.isOwnStorageUrl(url)).toBe(allowed);
    });

    it('accepts a URL this API issued, and refuses a lookalike host', async () => {
      const own = await upload(admin);
      expect(uploads.isOwnStorageUrl(own)).toBe(true);
      expect(uploads.isOwnStorageUrl(own.replace('localhost', 'localhost.evil.example'))).toBe(false);
      expect(uploads.isOwnStorageUrl(['https://', 'user', ':', 'pw', '@', new URL(own).host, '/uploads/uploads/x.webp'].join(''))).toBe(false);
    });

    it('refuses an external photo on a category', async () => {
      const cat = { slug: `upl-${Date.now()}`, name: 'Upl Cat', word: 'upl', blurb: 'Test', image: 'https://evil.example/c.jpg' };
      const res = await admin.agent.post('/admin/categories').send(cat).expect(400);
      expect(res.body.fields.image).toMatch(/uploaded through the app/);
      await admin.agent.post('/admin/categories').send({ ...cat, image: await upload(admin) }).expect(201);
      await t.prisma.category.deleteMany({ where: { slug: cat.slug } });
    });
  });

  it('sweeps images nobody used after a week: the record and the file, and nothing else', async () => {
    const orphanUrl = await upload(maya);
    const usedUrl = await upload(maya);
    const freshUrl = await upload(maya);
    const files = async () => (await readdir(join(dir, 'uploads'))).length;
    const before = await files();

    const old = new Date(Date.now() - 8 * 86_400_000);
    await t.prisma.upload.updateMany({ where: { url: { in: [orphanUrl, usedUrl] } }, data: { createdAt: old } });
    await t.prisma.upload.update({ where: { url: usedUrl }, data: { attachedAt: new Date() } });

    expect(await uploads.purgeOrphans()).toBeGreaterThanOrEqual(1);
    expect(await t.prisma.upload.findUnique({ where: { url: orphanUrl } })).toBeNull();
    expect(await t.prisma.upload.findUnique({ where: { url: usedUrl } })).not.toBeNull();
    expect(await t.prisma.upload.findUnique({ where: { url: freshUrl } })).not.toBeNull();
    expect(await files()).toBe(before - 1);
    const orphanFile = orphanUrl.split('/').pop()!;
    await expect(stat(join(dir, 'uploads', orphanFile))).rejects.toThrow();
  });
});
