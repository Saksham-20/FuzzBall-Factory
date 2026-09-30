import request from 'supertest';
import { WISHLIST_MAX } from '../src/wishlist/wishlist.service.js';
import { bootApp, makeUser, type TestApp, type TestUser } from './helpers/e2e.js';
import { makeProduct } from './helpers/commerce.js';

describe('wishlist (e2e)', () => {
  let t: TestApp;
  let ann: TestUser;
  let ben: TestUser;
  const tag = `wish${Date.now()}`;
  const productIds: string[] = [];

  const piece = async (status: 'PUBLISHED' | 'DRAFT' = 'PUBLISHED') => {
    const f = await makeProduct(t.prisma, tag, { status });
    productIds.push(f.productId);
    return f.productId;
  };
  const listed = async (u: TestUser) => ((await u.agent.get('/wishlist').expect(200)).body as { productId: string }[]).map((e) => e.productId);

  beforeAll(async () => {
    t = await bootApp();
    ann = await makeUser(t, 'customer', 'wish-ann');
    ben = await makeUser(t, 'customer', 'wish-ben');
  });
  afterAll(async () => {
    await t.prisma.user.deleteMany({ where: { id: { in: [ann.id, ben.id] } } });
    await t.prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await t.app.close();
  });

  it('needs a signed-in user', async () => {
    const id = await piece();
    await request(t.app.getHttpServer()).get('/wishlist').expect(401);
    await request(t.app.getHttpServer()).put(`/wishlist/${id}`).expect(401);
    await request(t.app.getHttpServer()).delete(`/wishlist/${id}`).expect(401);
  });

  it('adds, lists oldest first, removes; adding twice and removing twice are fine', async () => {
    const a = await piece();
    const b = await piece();
    await ann.agent.put(`/wishlist/${a}`).expect(204);
    await ann.agent.put(`/wishlist/${a}`).expect(204); // idempotent
    await ann.agent.put(`/wishlist/${b}`).expect(204);
    expect(await listed(ann)).toEqual([a, b]);
    expect(await t.prisma.wishlistItem.count({ where: { userId: ann.id, productId: a } })).toBe(1);

    await ann.agent.delete(`/wishlist/${a}`).expect(204);
    await ann.agent.delete(`/wishlist/${a}`).expect(204); // already gone
    expect(await listed(ann)).toEqual([b]);
  });

  it('is private: another account sees nothing of it and cannot remove it', async () => {
    const id = await piece();
    await ann.agent.put(`/wishlist/${id}`).expect(204);
    expect(await listed(ben)).toEqual([]);
    await ben.agent.delete(`/wishlist/${id}`).expect(204); // a no-op for Ben
    expect(await listed(ann)).toContain(id);
  });

  it('only published pieces can be saved, and an unpublished one drops out of the list', async () => {
    await ann.agent.put('/wishlist/no-such-product').expect(404);
    const draft = await piece('DRAFT');
    await ann.agent.put(`/wishlist/${draft}`).expect(404);

    const soon = await piece();
    await ann.agent.put(`/wishlist/${soon}`).expect(204);
    await t.prisma.product.update({ where: { id: soon }, data: { status: 'ARCHIVED' } });
    expect(await listed(ann)).not.toContain(soon);
  });

  it('merges a signed-out device into the account, skipping unknown and unpublished ids and duplicates', async () => {
    const fresh = await makeUser(t, 'customer', 'wish-merge');
    try {
      const a = await piece();
      const b = await piece();
      const draft = await piece('DRAFT');
      await fresh.agent.put(`/wishlist/${a}`).expect(204);
      const res = await fresh.agent.post('/wishlist/merge').send({ productIds: [a, b, b, draft, 'ghost'] }).expect(200);
      expect((res.body as { productId: string }[]).map((e) => e.productId).sort()).toEqual([a, b].sort());
      await fresh.agent.post('/wishlist/merge').send({ productIds: 'nope' }).expect(400);
      await fresh.agent.post('/wishlist/merge').send({ productIds: Array.from({ length: 101 }, (_, i) => `p${i}`) }).expect(400);
    } finally {
      await t.prisma.user.deleteMany({ where: { id: fresh.id } });
    }
  });

  it(`holds at most ${WISHLIST_MAX} pieces`, async () => {
    const full = await makeUser(t, 'customer', 'wish-full');
    try {
      const fixtures = [];
      for (let i = 0; i < WISHLIST_MAX + 1; i += 1) fixtures.push(await piece());
      await t.prisma.wishlistItem.createMany({ data: fixtures.slice(0, WISHLIST_MAX).map((productId) => ({ userId: full.id, productId })) });
      const over = await full.agent.put(`/wishlist/${fixtures[WISHLIST_MAX]}`).expect(422);
      expect(over.body.code).toBe('WISHLIST_FULL');
      await full.agent.put(`/wishlist/${fixtures[0]}`).expect(204); // already saved: still fine at the cap
      const merged = await full.agent.post('/wishlist/merge').send({ productIds: [fixtures[WISHLIST_MAX]] }).expect(200);
      expect(merged.body).toHaveLength(WISHLIST_MAX);
    } finally {
      await t.prisma.user.deleteMany({ where: { id: full.id } });
    }
  });
});
