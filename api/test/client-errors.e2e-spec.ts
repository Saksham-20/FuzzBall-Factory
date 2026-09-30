import request from 'supertest';
import { bootApp, type TestApp } from './helpers/e2e.js';

describe('storefront error intake (e2e)', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await bootApp({ throttle: true });
  });
  afterAll(async () => {
    await t.app.close();
  });
  const post = (body: object) => request(t.app.getHttpServer()).post('/client-errors').send(body);

  it('takes a short report without login and answers 204', async () => {
    await post({ message: 'Cannot read properties of undefined', digest: '1234567890', path: '/p/rosie-bear', kind: 'render' }).expect(204);
    await post({ message: 'root layout failed', kind: 'global' }).expect(204);
  });

  it('rejects empty, oversized, unknown-kind and extra fields', async () => {
    await post({ message: '', kind: 'render' }).expect(400);
    await post({ message: 'x'.repeat(301), kind: 'render' }).expect(400);
    await post({ message: 'boom', kind: 'other' }).expect(400);
    await post({ message: 'boom', kind: 'render', stack: 'a'.repeat(5000) }).expect(400);
  });

  it('is limited to ten a minute per address', async () => {
    // 2 accepted + 4 rejected so far count too; fill the rest, then the next one is refused.
    for (let i = 0; i < 4; i += 1) await post({ message: `again ${i}`, kind: 'render' }).expect(204);
    await post({ message: 'one too many', kind: 'render' }).expect(429);
  });
});
