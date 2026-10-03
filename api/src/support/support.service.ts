import { createHash, createHmac } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { conflict, notFound, validationFailed } from '../common/errors.js';
import { NumberingService } from '../common/numbering.service.js';
import { safeEqualHex } from '../common/hashing.service.js';
import type { RequestUser } from '../common/types/auth.types.js';
import type { Env } from '../config/env.js';
import type { TicketChannel, TicketKind } from '../generated/prisma/enums.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import type { CreateTicketDto } from './dto/support.dto.js';
import { TICKET_INCLUDE, toTicketDto, type TicketDto, type TicketRow } from './support.mapper.js';
import { AUTOCLOSE_DAYS, CATEGORIES, dueDates, slaOf, statusAfterCustomerMessage } from './support.rules.js';

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

const SUBJECT_LABEL: Record<TicketKind, string> = {
  SUPPORT: 'Message',
  GRIEVANCE: 'Complaint',
  IP_NOTICE: 'Copyright or trademark notice',
  DATA_REQUEST: 'Data request',
};

export interface CreateTicketInput {
  kind: TicketKind;
  channel?: TicketChannel;
  name: string;
  email?: string | null;
  phone?: string | null;
  category: string;
  reference?: string | null;
  message: string;
  attachments?: string[];
  /** Account the ticket belongs to (a signed-in sender, or the customer the maker logged it for). */
  userId?: string | null;
  /** When the customer really wrote (a complaint the maker logs from an earlier WhatsApp chat starts its clocks then). Defaults to now. */
  receivedAt?: Date;
  /** True when the customer already got an answer outside the site (the maker logged a WhatsApp chat, say). */
  alreadyAcknowledged?: boolean;
  /** Maker logging a ticket by hand: no "we got your request" email unless there is an address, and the first message is theirs to write. */
  logged?: boolean;
}

/**
 * Support tickets: the contact form, grievances, takedown notices and data requests all land here, with a reference
 * number, a thread and two clocks (see support.rules.ts). The same table is the grievance register.
 *
 * Guests reach their own ticket through a token in the emailed link: an HMAC of the ticket id under a key derived from
 * the server secret, so nothing secret is stored and every email about the ticket can carry the same working link.
 * Signed-in customers reach their tickets through their account. The private notes the maker writes (`internal`) are never
 * returned from any customer-facing method.
 */
@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly notifications: NotificationsService,
    private readonly uploads: UploadsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  private webOrigin(): string {
    return this.config.get('WEB_ORIGIN', { infer: true }).split(',')[0].trim().replace(/\/$/, '');
  }

  /** Where the shop's own notices go: CONTACT_INBOX_EMAIL, else the admin's address. Unset = tickets are still stored. */
  private inbox(): string | undefined {
    return this.config.get('CONTACT_INBOX_EMAIL', { infer: true }) ?? this.config.get('ADMIN_EMAIL', { infer: true });
  }

  /** The token that opens one ticket without signing in. Derived, not stored; changes only if the JWT secret does. */
  tokenFor(ticketId: string): string {
    const key = createHash('sha256').update(`support-ticket:${this.config.get('JWT_ACCESS_SECRET', { infer: true })}`).digest();
    return createHmac('sha256', key).update(ticketId).digest('hex').slice(0, 48);
  }

  guestUrl(number: string, token: string): string {
    return `${this.webOrigin()}/support/ticket/${encodeURIComponent(number)}?t=${token}`;
  }

  adminUrl(id: string): string {
    return `${this.webOrigin()}/admin/support/${id}`;
  }

  /** `POST /support/tickets` (the public forms). The honeypot is checked by the caller. */
  async createFromForm(dto: CreateTicketDto, user: RequestUser | undefined): Promise<{ number: string; accessToken: string }> {
    return this.create({
      kind: dto.kind,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      category: dto.category,
      reference: dto.reference,
      message: dto.message,
      attachments: dto.attachments ?? [],
      userId: user?.userId ?? null,
    });
  }

  async create(input: CreateTicketInput): Promise<{ number: string; accessToken: string; id: string }> {
    if (!CATEGORIES[input.kind].includes(input.category)) {
      throw validationFailed({ category: 'Choose one of the topics in the list.' });
    }
    const attachments = input.attachments ?? [];
    if (attachments.length > 0) {
      if (!input.userId) throw validationFailed({ attachments: 'Sign in to attach photos, or reply to our email with them.' });
      await this.uploads.assertOwned(input.userId, attachments, 'attachments');
    }

    const linked = await this.resolveReference(input.reference, input.email ?? null, input.userId ?? null);
    const subject = this.subjectFor(input, linked.label);
    const now = input.receivedAt ?? new Date();
    const ackedAtCreate = input.alreadyAcknowledged ? new Date() : null;

    const ticket = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.nextTicketNumber(input.kind, tx);
      const created = await tx.supportTicket.create({
        data: {
          number,
          kind: input.kind,
          channel: input.channel ?? 'WEB',
          category: input.category,
          subject,
          name: input.name,
          email: input.email?.toLowerCase() ?? null,
          phone: input.phone ?? null,
          userId: input.userId ?? null,
          orderId: linked.orderId,
          customRequestId: linked.requestId,
          ...dueDates(input.kind, now),
          ackedAt: ackedAtCreate,
          createdAt: now,
          lastActivityAt: now,
          messages: {
            create: [
              { author: 'customer', body: input.message, attachments },
              ...(linked.unverified ? [{ author: 'internal' as const, body: `They mentioned "${linked.unverified}", which does not match an order or work order for this email, so it is not linked.`, attachments: [] }] : []),
            ],
          },
        },
        include: TICKET_INCLUDE,
      });
      return created;
    });
    await this.uploads.markAttached(attachments);

    const token = this.tokenFor(ticket.id);
    const url = this.guestUrl(ticket.number, token);
    // The acknowledgement: the email counts as sent once it is queued (a failure stays visible in /admin/emails).
    if (ticket.email && (!input.logged || !input.alreadyAcknowledged)) {
      await this.notifications.send('ticket.received', {
        to: ticket.email,
        name: ticket.name,
        ticketNumber: ticket.number,
        subject: ticket.subject,
        url,
        grievance: ticket.kind === 'GRIEVANCE',
        message: input.message,
        resolveBy: dateFormat.format(ticket.resolveDueAt),
      });
      await this.prisma.supportTicket.update({ where: { id: ticket.id }, data: { ackedAt: ticket.ackedAt ?? new Date(), recordCopySentAt: new Date() } });
    }
    await this.notifyShop(ticket, input.message, false);
    return { number: ticket.number, accessToken: token, id: ticket.id };
  }

  private subjectFor(input: CreateTicketInput, referenceLabel: string | null): string {
    const topic = input.category.replace(/-/g, ' ');
    return `${SUBJECT_LABEL[input.kind]}: ${topic}${referenceLabel ? ` (${referenceLabel})` : ''}`;
  }

  /** Links an order or work order only when it belongs to the sender (their account, or the same email). Never reveals whether another number exists. */
  private async resolveReference(
    raw: string | null | undefined,
    email: string | null,
    userId: string | null,
  ): Promise<{ orderId: string | null; requestId: string | null; label: string | null; unverified: string | null }> {
    const none = { orderId: null, requestId: null, label: null, unverified: null };
    const ref = raw?.trim().toUpperCase();
    if (!ref) return none;
    const lower = email?.toLowerCase() ?? null;
    if (ref.startsWith('WO-')) {
      const wo = await this.prisma.customRequest.findUnique({ where: { number: ref }, select: { id: true, number: true, userId: true, user: { select: { email: true } } } });
      if (wo && (wo.userId === userId || (lower !== null && wo.user.email.toLowerCase() === lower))) return { orderId: null, requestId: wo.id, label: wo.number, unverified: null };
      return { ...none, unverified: ref };
    }
    const order = await this.prisma.order.findFirst({ where: { number: ref, OR: [...(userId ? [{ userId }] : []), ...(lower ? [{ contactEmail: { equals: lower, mode: 'insensitive' as const } }] : [])] }, select: { id: true, number: true } });
    if (order) return { orderId: order.id, requestId: null, label: order.number, unverified: null };
    return { ...none, unverified: ref };
  }

  private async notifyShop(ticket: Pick<TicketRow, 'id' | 'number' | 'subject' | 'name' | 'email' | 'kind'>, message: string, isReply: boolean): Promise<void> {
    const to = this.inbox();
    if (!to) {
      this.logger.warn(`No CONTACT_INBOX_EMAIL or ADMIN_EMAIL set: ticket ${ticket.number} is stored but nobody was emailed`);
      return;
    }
    await this.notifications.send('ticket.new_admin', {
      to,
      name: ticket.name,
      ticketNumber: ticket.number,
      subject: ticket.subject,
      url: this.adminUrl(ticket.id),
      ...(ticket.email ? { fromEmail: ticket.email } : {}),
      message,
      kind: ticket.kind,
      isReply,
    });
  }

  /** The guest's link: the token must match the one issued with the ticket. Anything else is a plain 404. */
  async getByToken(number: string, token: string): Promise<TicketRow> {
    const row = await this.prisma.supportTicket.findUnique({ where: { number }, include: TICKET_INCLUDE });
    if (!row || !safeEqualHex(this.tokenFor(row.id), token)) throw notFound('We could not find that request.');
    return row;
  }

  async getForUser(number: string, userId: string): Promise<TicketRow> {
    const row = await this.prisma.supportTicket.findUnique({ where: { number }, include: TICKET_INCLUDE });
    if (!row || row.userId !== userId) throw notFound('We could not find that request.');
    return row;
  }

  async listForUser(userId: string): Promise<TicketDto[]> {
    const rows = await this.prisma.supportTicket.findMany({ where: { userId }, orderBy: { lastActivityAt: 'desc' }, take: 100, include: TICKET_INCLUDE });
    return rows.map(toTicketDto);
  }

  /** The customer writes on an existing ticket (via the token or their account). Reopens a resolved ticket; a closed one needs a new request. */
  async addCustomerMessage(row: TicketRow, input: { body: string; attachments?: string[] }, userId: string | null): Promise<TicketDto> {
    const next = statusAfterCustomerMessage(row.status);
    if (next === null) throw conflict('This request is closed. Please start a new one.');
    const attachments = input.attachments ?? [];
    if (attachments.length > 0) {
      if (!userId) throw validationFailed({ attachments: 'Sign in to attach photos.' });
      await this.uploads.assertOwned(userId, attachments, 'attachments');
    }
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.supportMessage.create({ data: { ticketId: row.id, author: 'customer', body: input.body, attachments } });
      return tx.supportTicket.update({
        where: { id: row.id },
        data: { status: next, lastActivityAt: now, ...(row.status === 'RESOLVED' ? { resolvedAt: null } : {}) },
        include: TICKET_INCLUDE,
      });
    });
    await this.uploads.markAttached(attachments);
    await this.notifyShop(updated, input.body, true);
    return toTicketDto(updated);
  }

  // ---- background work -------------------------------------------------------------------------------------------

  /** Resolved tickets nobody answered for AUTOCLOSE_DAYS close by themselves. Returns how many. */
  async autoClose(now: Date = new Date(), autocloseDays = AUTOCLOSE_DAYS): Promise<number> {
    const cutoff = new Date(now.getTime() - autocloseDays * 86_400_000);
    const { count } = await this.prisma.supportTicket.updateMany({
      where: { status: 'RESOLVED', resolvedAt: { lt: cutoff }, lastActivityAt: { lt: cutoff } },
      data: { status: 'CLOSED', closedAt: now },
    });
    return count;
  }

  /**
   * Nudges the owner, once per deadline, about open tickets whose 48 hour acknowledgement or resolution date is close or
   * past (the law asks for both on a grievance). One email lists them all. Returns how many tickets were mentioned.
   */
  async slaSweep(now: Date = new Date()): Promise<number> {
    const to = this.inbox();
    const open = await this.prisma.supportTicket.findMany({ where: { status: { in: ['OPEN', 'WAITING_CUSTOMER'] } } });
    const items: { ticketNumber: string; subject: string; url: string; what: string }[] = [];
    const left = (ms: number) => (ms < 0 ? `overdue by ${Math.ceil(-ms / 3_600_000)} hours` : ms < 48 * 3_600_000 ? `due in ${Math.max(1, Math.floor(ms / 3_600_000))} hours` : `due in ${Math.floor(ms / 86_400_000)} days`);
    for (const t of open) {
      const sla = slaOf(t, now);
      const data: { ackReminderAt?: Date; resolveReminderAt?: Date } = {};
      if ((sla.ack === 'due-soon' || sla.ack === 'overdue') && !t.ackReminderAt) {
        items.push({ ticketNumber: t.number, subject: t.subject, url: this.adminUrl(t.id), what: `acknowledgement ${left(sla.ackMs)}` });
        data.ackReminderAt = now;
      }
      if ((sla.resolve === 'due-soon' || sla.resolve === 'overdue') && !t.resolveReminderAt) {
        items.push({ ticketNumber: t.number, subject: t.subject, url: this.adminUrl(t.id), what: `resolution ${left(sla.resolveMs)} (${dateFormat.format(t.resolveDueAt)})` });
        data.resolveReminderAt = now;
      }
      if (Object.keys(data).length > 0) await this.prisma.supportTicket.update({ where: { id: t.id }, data });
    }
    if (items.length > 0 && to) await this.notifications.send('ticket.sla_reminder', { to, name: 'the shop', items });
    else if (items.length > 0) this.logger.warn(`${items.length} support deadline(s) are near but no CONTACT_INBOX_EMAIL or ADMIN_EMAIL is set`);
    return items.length;
  }
}
