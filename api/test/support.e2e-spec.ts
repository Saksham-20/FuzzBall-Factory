import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { SupportService } from '../src/support/support.service.js';
import { RetentionService } from '../src/jobs/retention.service.js';
import { bootApp, makeUser, type TestApp, type TestUser } from './helpers/e2e.js';

describe('support tickets (e2e)', () => {
  let t: TestApp;
  let admin: TestUser;
  let ann: TestUser;
  let ben: TestUser;
  let support: SupportService;
  const stamp = Date.now().toString(36);
  const guestEmail = `guest-${stamp}@e2e.test`;
  const http = () => request(t.app.getHttpServer());
  const sentOf = (event: string) => t.sent.filter((s) => s.event === event);

  const form = (over: Record<string, unknown> = {}) => ({
    kind: 'GRIEVANCE', name: 'Guest Gita', email: guestEmail, category: 'refund', message: 'My refund has not arrived after two weeks.', consent: true, ...over,
  });
  const tokenOf = (res: { body: { number: string; accessToken: string } }) => ({ number: res.body.number, t: res.body.accessToken });

  beforeAll(async () => {
    t = await bootApp();
    t.app.get(ConfigService).set('CONTACT_INBOX_EMAIL', 'maker-inbox@example.com');
    support = t.app.get(SupportService);
    [admin, ann, ben] = [await makeUser(t, 'admin', 'sup-admin'), await makeUser(t, 'customer', 'sup-ann'), await makeUser(t, 'customer', 'sup-ben')];
  });
  afterAll(async () => {
    await t.prisma.supportTicket.deleteMany({ where: { OR: [{ email: { contains: stamp } }, { userId: { in: [ann.id, ben.id] } }, { name: { startsWith: `E2E-${stamp}` } }] } });
    await t.prisma.order.deleteMany({ where: { number: `FBT${stamp.toUpperCase()}` } });
    await t.prisma.user.deleteMany({ where: { id: { in: [admin.id, ann.id, ben.id] } } });
    await t.app.close();
  });

  describe('opening a ticket', () => {
    it('stores it, emails the reference and a copy of the complaint, tells the shop, and starts the clocks', async () => {
      const res = await http().post('/support/tickets').send(form()).expect(201);
      expect(res.body.number).toMatch(/^GRV-\d{4,}$/);
      expect(res.body.accessToken).toMatch(/^[a-f0-9]{48}$/);
      const row = await t.prisma.supportTicket.findUniqueOrThrow({ where: { number: res.body.number }, include: { messages: true } });
      expect(row).toMatchObject({ kind: 'GRIEVANCE', channel: 'WEB', status: 'OPEN', category: 'refund', userId: null });
      expect(row.ackedAt).not.toBeNull();
      expect(row.recordCopySentAt).not.toBeNull();
      expect(row.ackDueAt.getTime() - row.createdAt.getTime()).toBe(48 * 3_600_000);
      expect(row.resolveDueAt.getTime() - row.createdAt.getTime()).toBe(30 * 86_400_000);
      expect(row.messages).toHaveLength(1);
      const received = sentOf('ticket.received').at(-1)!.payload;
      expect(received).toMatchObject({ to: guestEmail, ticketNumber: row.number, grievance: true, message: form().message });
      expect(String(received.url)).toContain(`/support/ticket/${row.number}?t=${res.body.accessToken}`);
      expect(sentOf('ticket.new_admin').at(-1)!.payload).toMatchObject({ to: 'maker-inbox@example.com', ticketNumber: row.number, isReply: false });
    });

    it('rejects an unknown topic, a missing consent tick and unknown fields', async () => {
      expect((await http().post('/support/tickets').send(form({ category: 'nope' })).expect(400)).body.fields).toHaveProperty('category');
      expect((await http().post('/support/tickets').send(form({ consent: false })).expect(400)).body.fields).toHaveProperty('consent');
      await http().post('/support/tickets').send(form({ role: 'admin' })).expect(400);
    });

    it('lets only signed-in senders attach photos', async () => {
      const res = await http().post('/support/tickets').send(form({ attachments: ['/uploads/someone-elses.webp'] })).expect(400);
      expect(res.body.fields).toHaveProperty('attachments');
    });

    it('drops a honeypot submission without storing anything', async () => {
      const before = await t.prisma.supportTicket.count();
      await http().post('/support/tickets').send(form({ website: 'http://spam.example', email: `bot-${stamp}@e2e.test` })).expect(201);
      expect(await t.prisma.supportTicket.count()).toBe(before);
    });

    it('links an order only to its owner: a stranger naming it gets an unlinked ticket and a private note', async () => {
      const order = await t.prisma.order.create({
        data: {
          number: `FBT${stamp.toUpperCase()}`, userId: ann.id, contact: {}, contactEmail: ann.email, contactPhone: '9811122233', address: {}, subtotal: 1, total: 1, paymentMethod: 'COD', estimatedDispatch: new Date(),
        },
      });
      const mine = await ann.agent.post('/support/tickets').send(form({ kind: 'SUPPORT', category: 'order', email: ann.email, reference: order.number })).expect(201);
      const linked = await t.prisma.supportTicket.findUniqueOrThrow({ where: { number: mine.body.number } });
      expect(linked).toMatchObject({ orderId: order.id, userId: ann.id });
      const stranger = await http().post('/support/tickets').send(form({ kind: 'SUPPORT', category: 'order', reference: order.number })).expect(201);
      const unlinked = await t.prisma.supportTicket.findUniqueOrThrow({ where: { number: stranger.body.number }, include: { messages: true } });
      expect(unlinked.orderId).toBeNull();
      expect(unlinked.messages.some((m) => m.author === 'internal' && m.body.includes(order.number))).toBe(true);
      await t.prisma.supportTicket.deleteMany({ where: { orderId: order.id } });
      await t.prisma.order.delete({ where: { id: order.id } });
    });
  });

  describe('the customer view', () => {
    let guest: { number: string; t: string };
    beforeAll(async () => {
      guest = tokenOf(await http().post('/support/tickets').send(form({ kind: 'SUPPORT', category: 'general', message: 'Do you make bunny plushies?' })).expect(201));
    });

    it('opens by the emailed token only', async () => {
      const ok = await http().get(`/support/tickets/${guest.number}`).query({ t: guest.t }).expect(200);
      expect(ok.body).toMatchObject({ number: guest.number, status: 'OPEN', kind: 'SUPPORT' });
      expect(ok.body).not.toHaveProperty('email');
      await http().get(`/support/tickets/${guest.number}`).query({ t: 'a'.repeat(48) }).expect(404);
      await http().get(`/support/tickets/${guest.number}`).expect(400);
      await http().get(`/support/tickets/SUP-9999999`).query({ t: guest.t }).expect(404);
    });

    it('a guest reply keeps it open; the maker private note never shows', async () => {
      const row = await t.prisma.supportTicket.findUniqueOrThrow({ where: { number: guest.number } });
      await admin.agent.post(`/admin/support/${row.id}/messages`).send({ body: 'Check stock before replying.', internal: true }).expect(201);
      await admin.agent.post(`/admin/support/${row.id}/messages`).send({ body: 'Yes we do, in blue.', internal: false }).expect(201);
      const reply = await http().post(`/support/tickets/${guest.number}/messages`).query({ t: guest.t }).send({ body: 'Lovely, how much?' }).expect(201);
      expect(reply.body.status).toBe('OPEN');
      expect(reply.body.messages.map((m: { author: string }) => m.author)).toEqual(['customer', 'maker', 'customer']);
      expect(JSON.stringify(reply.body)).not.toContain('Check stock');
      expect(sentOf('ticket.new_admin').at(-1)!.payload).toMatchObject({ ticketNumber: guest.number, isReply: true });
    });

    it('a closed request cannot be answered', async () => {
      const row = await t.prisma.supportTicket.findUniqueOrThrow({ where: { number: guest.number } });
      await admin.agent.patch(`/admin/support/${row.id}`).send({ status: 'CLOSED' }).expect(200);
      await http().post(`/support/tickets/${guest.number}/messages`).query({ t: guest.t }).send({ body: 'Hello?' }).expect(409);
    });

    it('a signed-in customer sees only their own tickets', async () => {
      const mine = tokenOf(await ann.agent.post('/support/tickets').send(form({ kind: 'SUPPORT', category: 'general', email: ann.email, name: `E2E-${stamp} Ann` })).expect(201));
      const list = (await ann.agent.get('/account/tickets').expect(200)).body as { number: string }[];
      expect(list.map((x) => x.number)).toContain(mine.number);
      expect((await ben.agent.get('/account/tickets').expect(200)).body).toEqual([]);
      await ann.agent.get(`/account/tickets/${mine.number}`).expect(200);
      await ben.agent.get(`/account/tickets/${mine.number}`).expect(404);
      await ben.agent.post(`/account/tickets/${mine.number}/messages`).send({ body: 'sneaky' }).expect(404);
      await ann.agent.post(`/account/tickets/${mine.number}/messages`).send({ body: 'one more thing' }).expect(201);
      await http().get('/account/tickets').expect(401);
    });
  });

  describe('the maker side', () => {
    it('logs a WhatsApp complaint with its real received date, already answered: clocks start then, no email goes out', async () => {
      const before = sentOf('ticket.received').length;
      const fiveDaysAgo = new Date(Date.now() - 5 * 86_400_000);
      const res = await admin.agent
        .post('/admin/support')
        .send({ kind: 'GRIEVANCE', channel: 'WHATSAPP', name: `E2E-${stamp} Walk-in`, phone: '9811122233', category: 'delivery', message: 'Parcel late, said on WhatsApp.', receivedAt: fiveDaysAgo.toISOString(), alreadyAcknowledged: true })
        .expect(201);
      expect(res.body).toMatchObject({ kind: 'GRIEVANCE', channel: 'WHATSAPP', status: 'OPEN' });
      expect(res.body).not.toHaveProperty('email');
      expect(new Date(res.body.createdAt).getTime()).toBe(fiveDaysAgo.getTime());
      expect(new Date(res.body.resolveDueAt).getTime() - fiveDaysAgo.getTime()).toBe(30 * 86_400_000);
      expect(res.body.sla.ack).toBe('done');
      expect(sentOf('ticket.received')).toHaveLength(before);
      await admin.agent.post('/admin/support').send({ kind: 'GRIEVANCE', channel: 'WHATSAPP', name: 'X', category: 'delivery', message: 'abc', receivedAt: new Date(Date.now() + 86_400_000).toISOString(), alreadyAcknowledged: true }).expect(400);
    });

    it('replies (the customer gets the link), resolves with a required note, reopens, and the audit trail records each step', async () => {
      const made = tokenOf(await http().post('/support/tickets').send(form({ email: `flow-${stamp}@e2e.test` })).expect(201));
      const row = await t.prisma.supportTicket.findUniqueOrThrow({ where: { number: made.number } });
      const replied = await admin.agent.post(`/admin/support/${row.id}/messages`).send({ body: 'Looking into it today.', internal: false }).expect(201);
      expect(replied.body.status).toBe('WAITING_CUSTOMER');
      expect(replied.body.firstResponseAt).toBeTruthy();
      const email = sentOf('ticket.reply').at(-1)!.payload;
      expect(email).toMatchObject({ to: `flow-${stamp}@e2e.test`, message: 'Looking into it today.', grievance: true });
      expect(String(email.url)).toContain(`?t=${made.t}`);

      await admin.agent.post(`/admin/support/${row.id}/resolve`).send({ note: '', notify: true }).expect(400);
      const resolved = (await admin.agent.post(`/admin/support/${row.id}/resolve`).send({ note: 'Refund of 450 sent to the original method.', notify: true }).expect(200)).body;
      expect(resolved).toMatchObject({ status: 'RESOLVED', resolutionNote: 'Refund of 450 sent to the original method.' });
      expect(sentOf('ticket.resolved').at(-1)!.payload).toMatchObject({ ticketNumber: made.number, grievance: true });
      await admin.agent.post(`/admin/support/${row.id}/resolve`).send({ note: 'again', notify: false }).expect(409);

      // The customer answering a resolved ticket reopens it.
      const again = await http().post(`/support/tickets/${made.number}/messages`).query({ t: made.t }).send({ body: 'It still has not arrived.' }).expect(201);
      expect(again.body.status).toBe('OPEN');
      expect(again.body.resolvedAt).toBeUndefined();

      await admin.agent.post(`/admin/support/${row.id}/resolve`).send({ note: 'Refund confirmed by the bank.', notify: false }).expect(200);
      await admin.agent.post(`/admin/support/${row.id}/reopen`).expect(200);
      await admin.agent.post(`/admin/support/${row.id}/reopen`).expect(409);

      const actions = (await t.prisma.auditLog.findMany({ where: { entity: 'SupportTicket', entityId: row.id }, orderBy: { createdAt: 'asc' } })).map((a) => a.action);
      expect(actions).toEqual(['support.reply', 'support.resolve', 'support.resolve', 'support.reopen']);
    });

    it('lists with filters and counts, and links an order by number', async () => {
      const list = (await admin.agent.get('/admin/support').query({ status: 'ACTIVE', kind: 'GRIEVANCE' }).expect(200)).body as { kind: string; status: string }[];
      expect(list.length).toBeGreaterThan(0);
      expect(list.every((x) => x.kind === 'GRIEVANCE' && (x.status === 'OPEN' || x.status === 'WAITING_CUSTOMER'))).toBe(true);
      const counts = (await admin.agent.get('/admin/support/counts').expect(200)).body;
      expect(counts).toEqual({ open: expect.any(Number), unacknowledged: expect.any(Number), dueSoon: expect.any(Number), overdue: expect.any(Number) });
      const row = await t.prisma.supportTicket.findFirstOrThrow({ where: { email: guestEmail } });
      await admin.agent.patch(`/admin/support/${row.id}`).send({ reference: 'FB-0000000' }).expect(400);
      await admin.agent.patch(`/admin/support/${row.id}`).send({ category: 'nope' }).expect(400);
    });

    it('exports the grievance register without personal details, and defuses spreadsheet formulas', async () => {
      const res = await admin.agent.get('/admin/support/register.csv').expect(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text.split('\n')[0]).toBe('number,kind,channel,category,received,acknowledged,copy_of_complaint_sent,first_response,resolve_by,resolved,status,order_or_work_order,resolution');
      expect(res.text).toMatch(/GRV-\d+/);
      expect(res.text).not.toContain(guestEmail);
      const row = await t.prisma.supportTicket.findFirstOrThrow({ where: { email: guestEmail } });
      await t.prisma.supportTicket.update({ where: { id: row.id }, data: { resolutionNote: '=HYPERLINK("http://evil")' } });
      const csv = (await admin.agent.get('/admin/support/register.csv').expect(200)).text;
      expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    });

    it('keeps the admin routes admin-only', async () => {
      await ann.agent.get('/admin/support').expect(403);
      await ann.agent.get('/admin/support/register.csv').expect(403);
      await http().get('/admin/support').expect(401);
    });
  });

  describe('background work and privacy', () => {
    it('reminds the owner once per deadline, auto-closes resolved tickets, and purges old closed ones', async () => {
      const made = tokenOf(await http().post('/support/tickets').send(form({ kind: 'SUPPORT', category: 'general', email: `sla-${stamp}@e2e.test` })).expect(201));
      const row = await t.prisma.supportTicket.findUniqueOrThrow({ where: { number: made.number } });
      await t.prisma.supportTicket.update({ where: { id: row.id }, data: { ackedAt: null, ackDueAt: new Date(Date.now() + 3_600_000) } });
      const before = sentOf('ticket.sla_reminder').length;
      expect(await support.slaSweep()).toBeGreaterThanOrEqual(1);
      expect(sentOf('ticket.sla_reminder').length).toBe(before + 1);
      const mentions = (sentOf('ticket.sla_reminder').at(-1)!.payload.items as { ticketNumber: string }[]).map((i) => i.ticketNumber);
      expect(mentions).toContain(made.number);
      await support.slaSweep();
      const second = (sentOf('ticket.sla_reminder').at(-1)!.payload.items as { ticketNumber: string }[]).map((i) => i.ticketNumber);
      expect(sentOf('ticket.sla_reminder').length === before + 1 || !second.includes(made.number)).toBe(true);

      await t.prisma.supportTicket.update({ where: { id: row.id }, data: { status: 'RESOLVED', resolvedAt: new Date(Date.now() - 20 * 86_400_000), lastActivityAt: new Date(Date.now() - 20 * 86_400_000) } });
      expect(await support.autoClose()).toBeGreaterThanOrEqual(1);
      expect((await t.prisma.supportTicket.findUniqueOrThrow({ where: { id: row.id } })).status).toBe('CLOSED');

      await t.prisma.supportTicket.update({ where: { id: row.id }, data: { closedAt: new Date(Date.now() - 4 * 365 * 86_400_000) } });
      expect(await t.app.get(RetentionService).purgeSupportTickets()).toBeGreaterThanOrEqual(1);
      expect(await t.prisma.supportTicket.count({ where: { id: row.id } })).toBe(0);
      expect(await t.prisma.supportMessage.count({ where: { ticketId: row.id } })).toBe(0);
    });

    it('is part of the data export, and erasure scrubs the person but keeps the register fields', async () => {
      const exported = (await ann.agent.get('/account/export').expect(200)).body as { supportRequests: { number: string }[] };
      expect(exported.supportRequests.length).toBeGreaterThan(0);

      const mine = await t.prisma.supportTicket.findMany({ where: { userId: ann.id } });
      // An open ticket defers erasure; resolve them first.
      await t.prisma.supportTicket.updateMany({ where: { userId: ann.id }, data: { status: 'RESOLVED', resolvedAt: new Date(), resolutionNote: 'done' } });
      await t.prisma.user.update({ where: { id: ann.id }, data: { deletionRequestedAt: new Date(Date.now() - 31 * 86_400_000) } });
      const { ErasureService } = await import('../src/account/erasure.service.js');
      expect(await t.app.get(ErasureService).erase(ann.id)).toBe('erased');
      const after = await t.prisma.supportTicket.findMany({ where: { id: { in: mine.map((m) => m.id) } }, include: { messages: true } });
      expect(after.length).toBe(mine.length);
      for (const row of after) {
        expect(row).toMatchObject({ name: 'Deleted customer', email: null, phone: null, userId: null, kind: 'SUPPORT' });
        expect(row.scrubbedAt).not.toBeNull();
        expect(row.messages).toEqual([]);
        expect(row.number).toMatch(/^SUP-/);
      }
    });

    it('defers erasure while a support request is still open', async () => {
      await ben.agent.post('/support/tickets').send(form({ kind: 'SUPPORT', category: 'general', email: ben.email })).expect(201);
      const { ErasureService } = await import('../src/account/erasure.service.js');
      expect(await t.app.get(ErasureService).blocker(ben.id)).toMatch(/open support request/);
    });
  });
});
