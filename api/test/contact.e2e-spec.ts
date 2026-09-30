import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { bootApp, type TestApp } from './helpers/e2e.js';

describe('contact form (e2e)', () => {
  let t: TestApp;
  beforeAll(async () => {
    // Real rate limits stay on: the last test hits the hourly cap.
    t = await bootApp({ throttle: true });
    t.app.get(ConfigService).set('CONTACT_INBOX_EMAIL', 'maker-inbox@example.com');
  });
  afterAll(async () => {
    await t.app.close();
  });

  const post = (body: object) => request(t.app.getHttpServer()).post('/contact').send(body);
  const good = { name: 'Maya', email: 'Maya@Example.com ', message: 'Do you make bunny plushies in blue?' };

  it('passes a message to the shop inbox, with the visitor address normalised', async () => {
    await post(good).expect(204);
    expect(t.sent.at(-1)).toEqual({
      event: 'contact.message',
      payload: { to: 'maker-inbox@example.com', name: 'Maya', fromEmail: 'maya@example.com', message: good.message },
    });
  });

  it('drops a honeypot submission quietly', async () => {
    const before = t.sent.length;
    await post({ ...good, website: 'http://spam.example' }).expect(204);
    expect(t.sent).toHaveLength(before);
  });

  it('rejects bad input with field messages, and unknown fields', async () => {
    const short = await post({ ...good, message: 'hi' }).expect(400);
    expect(short.body.fields).toHaveProperty('message');
    const email = await post({ ...good, email: 'not-an-email' }).expect(400);
    expect(email.body.fields).toHaveProperty('email');
    await post({ ...good, role: 'admin' }).expect(400);
  });

  it('allows five requests an hour per address, then answers 429', async () => {
    // Used so far: 1 send + 1 honeypot + 3 rejected.
    await post(good).expect(429);
    expect(t.sent.filter((s) => s.event === 'contact.message')).toHaveLength(1);
  });
});
