import request from 'supertest';
import { adminRoutes } from './helpers/admin-routes.js';
import { bootApp, makeUser, type TestApp, type TestUser } from './helpers/e2e.js';

/** Iterates the real route list of every admin controller: nobody but an admin gets past the guards. */
describe('admin authorization (e2e)', () => {
  let t: TestApp;
  let customer: TestUser;
  let admin: TestUser;
  const routes = adminRoutes().map((r) => ({ ...r, url: r.path.replace(/:\w+/g, 'x') }));

  beforeAll(async () => {
    t = await bootApp();
    [customer, admin] = [await makeUser(t, 'customer', 'authz-customer'), await makeUser(t, 'admin', 'authz-admin')];
  });

  afterAll(async () => {
    await t.prisma.auditLog.deleteMany({ where: { actorId: admin.id } });
    await t.prisma.user.deleteMany({ where: { id: { in: [customer.id, admin.id] } } });
    await t.app.close();
  });

  const call = (agent: ReturnType<typeof request.agent>, method: string, url: string) => {
    const verb = method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    const req = agent[verb](url);
    return method === 'GET' || method === 'DELETE' ? req : req.send({});
  };

  it('discovers the whole admin surface', () => {
    expect(routes.length).toBeGreaterThanOrEqual(35);
    expect(routes.every((r) => r.path.startsWith('/admin/'))).toBe(true);
  });

  it('a guest gets 401 on every admin route', async () => {
    for (const r of routes) {
      const res = await call(request.agent(t.app.getHttpServer()), r.method, r.url);
      expect(res.status, `${r.method} ${r.url}`).toBe(401);
      expect(res.body.code).toBe('UNAUTHENTICATED');
    }
  });

  it('a signed-in customer gets 403 on every admin route', async () => {
    for (const r of routes) {
      const res = await call(customer.agent, r.method, r.url);
      expect(res.status, `${r.method} ${r.url}`).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    }
  });

  it('an admin is let through (validation/not-found errors, never 401/403)', async () => {
    for (const r of routes.filter((x) => x.method === 'GET')) {
      const res = await call(admin.agent, r.method, r.url);
      expect([401, 403], `${r.method} ${r.url}`).not.toContain(res.status);
    }
  });

  it('an unknown /admin path is refused for a customer too (fail closed)', async () => {
    const res = await customer.agent.get('/admin/definitely-not-a-route');
    expect([403, 404]).toContain(res.status);
    await request(t.app.getHttpServer()).get('/admin/definitely-not-a-route').expect((r) => expect([401, 403, 404]).toContain(r.status));
  });
});
