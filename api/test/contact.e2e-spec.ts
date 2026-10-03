import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { bootApp, type TestApp } from './helpers/e2e.js';

describe('contact form (e2e)', () => {
  let t: TestApp;
  const emails = [`contact-${Date.now()}@e2e.test`];
  beforeAll(async () => {
    // Real rate limits stay on: the last test hits the hourly cap.
    t = await bootApp({ throttle: true });
    t.app.get(ConfigService).set('CONTACT_INBOX_EMAIL', 'maker-inbox@example.com');
  });
  afterAll(async () => {
    await t.prisma.supportTicket.deleteMany({ where: { email: { in: emails } } });
    await t.app.close();
  });

  const post = (body: object) => request(t.app.getHttpServer()).post('/contact').send(body);
  const good = { name: 'Maya', email: ` ${emails[0].toUpperCase()} `, message: 'Do you make bunny plushies in blue?' };

  it('opens a support ticket: the visitor gets a reference by email and the shop inbox is told', async () => {
    await post(good).expect(204);
    const ticket = await t.prisma.supportTicket.findFirstOrThrow({ where: { email: emails[0] }, include: { messages: true } });
    expect(ticket).toMatchObject({ kind: 'SUPPORT', channel: 'WEB', category: 'general', status: 'OPEN' });
    expect(ticket.messages.map((m) => [m.author, m.body])).toEqual([['customer', good.message]]);
    const toVisitor = t.sent.find((s) => s.event === 'ticket.received');
    expect(toVisitor?.payload).toMatchObject({ to: emails[0], name: 'Maya', ticketNumber: ticket.number, message: good.message });
    const toShop = t.sent.find((s) => s.event === 'ticket.new_admin');
    expect(toShop?.payload).toMatchObject({ to: 'maker-inbox@example.com', fromEmail: emails[0], isReply: false });
  });

  it('drops a honeypot submission quietly', async () => {
    const before = await t.prisma.supportTicket.count();
    await post({ ...good, website: 'http://spam.example' }).expect(204);
    expect(await t.prisma.supportTicket.count()).toBe(before);
  });

  it('rejects bad input with field messages, and unknown fields', async () => {
    const short = await post({ ...good, message: 'hi' }).expect(400);
    expect(short.body.fields).toHaveProperty('message');
    const email = await post({ ...good, email: 'not-an-email' }).expect(400);
    expect(email.body.fields).toHaveProperty('email');
    await post({ ...good, role: 'admin' }).expect(400);
  });

  it('allows five requests an hour per address, then answers 429', async () => {
    // Used so far: 1 ticket + 1 honeypot + 3 rejected.
    await post(good).expect(429);
  });
});
