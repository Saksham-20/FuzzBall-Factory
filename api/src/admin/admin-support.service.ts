import { Injectable } from '@nestjs/common';
import { conflict, notFound, validationFailed } from '../common/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toAdminTicketDto, TICKET_INCLUDE, type AdminTicketDto, type TicketRow } from '../support/support.mapper.js';
import { CATEGORIES, isOpen, slaOf, statusAfterMakerReply } from '../support/support.rules.js';
import { SupportService } from '../support/support.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { LIST_CAP } from '../common/list-cap.js';
import type { AdminCtx } from './admin-custom.service.js';
import { AuditService } from './audit.service.js';
import type { LogTicketDto, RegisterQuery, SupportListQuery, SupportPatchDto, SupportReplyDto, SupportResolveDto } from './dto/support.dto.js';

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

export interface SupportCountsDto {
  open: number;
  unacknowledged: number;
  dueSoon: number;
  overdue: number;
}

/** What the register (CSV) records per ticket: the legal clocks and the outcome. */
const REGISTER_HEAD = ['number', 'kind', 'channel', 'category', 'received', 'acknowledged', 'copy_of_complaint_sent', 'first_response', 'resolve_by', 'resolved', 'status', 'order_or_work_order', 'resolution'];

const csvCell = (v: string) => {
  // A cell that starts with = + - @ would be run as a formula by a spreadsheet: prefix it.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** The maker's side of the inbox. Every write is audited; nothing here ever deletes a ticket. */
@Injectable()
export class AdminSupportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly support: SupportService,
    private readonly notifications: NotificationsService,
    private readonly uploads: UploadsService,
  ) {}

  private async load(id: string): Promise<TicketRow> {
    const row = await this.prisma.supportTicket.findUnique({ where: { id }, include: TICKET_INCLUDE });
    if (!row) throw notFound('We could not find that request.');
    return row;
  }

  async get(id: string): Promise<AdminTicketDto> {
    return toAdminTicketDto(await this.load(id));
  }

  async list(q: SupportListQuery): Promise<AdminTicketDto[]> {
    const where: Prisma.SupportTicketWhereInput = {
      ...(q.status === 'ACTIVE' ? { status: { in: ['OPEN', 'WAITING_CUSTOMER'] } } : q.status ? { status: q.status } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.q
        ? { OR: [{ number: { contains: q.q, mode: 'insensitive' } }, { name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }, { subject: { contains: q.q, mode: 'insensitive' } }] }
        : {}),
    };
    // Show only the last message in the list: the thread is for the detail page.
    const rows = await this.prisma.supportTicket.findMany({
      where,
      include: { ...TICKET_INCLUDE, messages: { orderBy: { createdAt: 'desc' as const }, take: 1 } },
      orderBy: [{ lastActivityAt: 'desc' }, { id: 'desc' }],
      take: LIST_CAP,
    });
    const now = new Date();
    let out = rows.map((r) => toAdminTicketDto(r, now));
    if (q.filter) {
      out = out.filter((t) => {
        if (t.status === 'RESOLVED' || t.status === 'CLOSED') return false;
        if (q.filter === 'unacknowledged') return t.sla.ack !== 'done';
        if (q.filter === 'overdue') return t.sla.ack === 'overdue' || t.sla.resolve === 'overdue';
        return t.sla.ack === 'due-soon' || t.sla.resolve === 'due-soon';
      });
    }
    // Open tickets by the nearest deadline first, then the rest by recent activity.
    return out.sort((a, b) => {
      const openA = a.status === 'OPEN' || a.status === 'WAITING_CUSTOMER';
      const openB = b.status === 'OPEN' || b.status === 'WAITING_CUSTOMER';
      if (openA !== openB) return openA ? -1 : 1;
      if (openA) return Math.min(a.sla.ackMs > 0 && a.sla.ack !== 'done' ? a.sla.ackMs : Infinity, a.sla.resolveMs) - Math.min(b.sla.ackMs > 0 && b.sla.ack !== 'done' ? b.sla.ackMs : Infinity, b.sla.resolveMs);
      return b.lastActivityAt.localeCompare(a.lastActivityAt);
    });
  }

  /** Numbers for the dashboard and the nav badge. */
  async counts(now: Date = new Date()): Promise<SupportCountsDto> {
    const open = await this.prisma.supportTicket.findMany({
      where: { status: { in: ['OPEN', 'WAITING_CUSTOMER'] } },
      select: { status: true, kind: true, ackDueAt: true, ackedAt: true, resolveDueAt: true, resolvedAt: true },
    });
    const out: SupportCountsDto = { open: open.length, unacknowledged: 0, dueSoon: 0, overdue: 0 };
    for (const t of open) {
      const sla = slaOf(t, now);
      if (sla.ack !== 'done') out.unacknowledged += 1;
      if (sla.ack === 'overdue' || sla.resolve === 'overdue') out.overdue += 1;
      else if (sla.ack === 'due-soon' || sla.resolve === 'due-soon') out.dueSoon += 1;
    }
    return out;
  }

  /** A ticket the maker records by hand. Its clocks start when the customer really wrote. */
  async log(ctx: AdminCtx, dto: LogTicketDto): Promise<AdminTicketDto> {
    if (!CATEGORIES[dto.kind].includes(dto.category)) throw validationFailed({ category: 'Choose one of the topics in the list.' });
    if (dto.receivedAt && dto.receivedAt.getTime() > Date.now()) throw validationFailed({ receivedAt: 'That date is in the future.' });
    const known = dto.email ? await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } }) : null;
    const created = await this.support.create({
      kind: dto.kind,
      channel: dto.channel,
      name: dto.name,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      category: dto.category,
      reference: dto.reference ?? null,
      message: dto.message,
      userId: known?.id ?? null,
      receivedAt: dto.receivedAt,
      alreadyAcknowledged: dto.alreadyAcknowledged,
      logged: true,
    });
    await this.audit.log({ actorId: ctx.actorId, action: 'support.log', entity: 'SupportTicket', entityId: created.id, meta: { number: created.number, kind: dto.kind, channel: dto.channel }, ip: ctx.ip });
    return this.get(created.id);
  }

  async reply(ctx: AdminCtx, id: string, dto: SupportReplyDto): Promise<AdminTicketDto> {
    const row = await this.load(id);
    const attachments = dto.attachments ?? [];
    if (attachments.length > 0) await this.uploads.assertOwned(ctx.actorId, attachments, 'attachments');
    const now = new Date();
    const makerReply = !dto.internal;
    if (makerReply && row.status === 'CLOSED') throw conflict('This request is closed. Reopen it to reply.');
    await this.prisma.$transaction(async (tx) => {
      await tx.supportMessage.create({ data: { ticketId: id, author: dto.internal ? 'internal' : 'maker', body: dto.body, attachments, ...(makerReply && row.email ? { emailedAt: now } : {}) } });
      await tx.supportTicket.update({
        where: { id },
        data: {
          lastActivityAt: now,
          ...(makerReply
            ? { status: statusAfterMakerReply(row.status), firstResponseAt: row.firstResponseAt ?? now, ackedAt: row.ackedAt ?? now }
            : {}),
        },
      });
      await this.audit.log({ actorId: ctx.actorId, action: dto.internal ? 'support.note' : 'support.reply', entity: 'SupportTicket', entityId: id, meta: { number: row.number }, ip: ctx.ip }, tx);
    });
    await this.uploads.markAttached(attachments);
    if (makerReply && row.email) {
      await this.notifications.send('ticket.reply', {
        to: row.email,
        name: row.name,
        ticketNumber: row.number,
        subject: row.subject,
        url: this.support.guestUrl(row.number, this.support.tokenFor(row.id)),
        message: dto.body,
        grievance: row.kind === 'GRIEVANCE',
      });
    }
    return this.get(id);
  }

  /** The customer was answered outside the site (WhatsApp, phone): stop the 48 hour clock without sending an email. */
  async acknowledge(ctx: AdminCtx, id: string): Promise<AdminTicketDto> {
    const row = await this.load(id);
    if (!row.ackedAt) {
      await this.prisma.supportTicket.update({ where: { id }, data: { ackedAt: new Date(), lastActivityAt: new Date() } });
      await this.audit.log({ actorId: ctx.actorId, action: 'support.acknowledge', entity: 'SupportTicket', entityId: id, meta: { number: row.number }, ip: ctx.ip });
    }
    return this.get(id);
  }

  async patch(ctx: AdminCtx, id: string, dto: SupportPatchDto): Promise<AdminTicketDto> {
    const row = await this.load(id);
    if (dto.category && !CATEGORIES[row.kind].includes(dto.category)) throw validationFailed({ category: 'Choose one of the topics in the list.' });
    const data: Prisma.SupportTicketUpdateInput = {};
    if (dto.category) data.category = dto.category;
    if (dto.status && dto.status !== row.status) {
      data.status = dto.status;
      data.closedAt = dto.status === 'CLOSED' ? new Date() : null;
      if (dto.status !== 'CLOSED' && row.status === 'RESOLVED') data.resolvedAt = null;
    }
    if (dto.reference !== undefined) {
      const ref = dto.reference.trim().toUpperCase();
      if (!ref) {
        data.order = { disconnect: true };
        data.request = { disconnect: true };
      } else if (ref.startsWith('WO-')) {
        const wo = await this.prisma.customRequest.findUnique({ where: { number: ref }, select: { id: true } });
        if (!wo) throw validationFailed({ reference: 'No work order has that number.' });
        data.request = { connect: { id: wo.id } };
        data.order = { disconnect: true };
      } else {
        const order = await this.prisma.order.findUnique({ where: { number: ref }, select: { id: true } });
        if (!order) throw validationFailed({ reference: 'No order has that number.' });
        data.order = { connect: { id: order.id } };
        data.request = { disconnect: true };
      }
    }
    if (Object.keys(data).length > 0) {
      await this.prisma.supportTicket.update({ where: { id }, data: { ...data, lastActivityAt: new Date() } });
      await this.audit.log({ actorId: ctx.actorId, action: 'support.update', entity: 'SupportTicket', entityId: id, meta: { number: row.number, ...(dto.status ? { status: dto.status } : {}), ...(dto.category ? { category: dto.category } : {}), ...(dto.reference !== undefined ? { reference: dto.reference } : {}) }, ip: ctx.ip });
    }
    return this.get(id);
  }

  async resolve(ctx: AdminCtx, id: string, dto: SupportResolveDto): Promise<AdminTicketDto> {
    const row = await this.load(id);
    if (!isOpen(row.status)) throw conflict('This request is already resolved or closed.');
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.supportMessage.create({ data: { ticketId: id, author: 'maker', body: `Resolved: ${dto.note}`, attachments: [], ...(dto.notify && row.email ? { emailedAt: now } : {}) } });
      await tx.supportTicket.update({
        where: { id },
        data: { status: 'RESOLVED', resolvedAt: now, resolutionNote: dto.note, lastActivityAt: now, firstResponseAt: row.firstResponseAt ?? now, ackedAt: row.ackedAt ?? now },
      });
      await this.audit.log({ actorId: ctx.actorId, action: 'support.resolve', entity: 'SupportTicket', entityId: id, meta: { number: row.number, notified: dto.notify && !!row.email }, ip: ctx.ip }, tx);
    });
    if (dto.notify && row.email) {
      await this.notifications.send('ticket.resolved', {
        to: row.email,
        name: row.name,
        ticketNumber: row.number,
        subject: row.subject,
        url: this.support.guestUrl(row.number, this.support.tokenFor(row.id)),
        message: dto.note,
        grievance: row.kind === 'GRIEVANCE',
      });
    }
    return this.get(id);
  }

  async reopen(ctx: AdminCtx, id: string): Promise<AdminTicketDto> {
    const row = await this.load(id);
    if (isOpen(row.status)) throw conflict('This request is already open.');
    await this.prisma.supportTicket.update({ where: { id }, data: { status: 'OPEN', resolvedAt: null, closedAt: null, lastActivityAt: new Date() } });
    await this.audit.log({ actorId: ctx.actorId, action: 'support.reopen', entity: 'SupportTicket', entityId: id, meta: { number: row.number }, ip: ctx.ip });
    return this.get(id);
  }

  /** The grievance register as CSV: one row per ticket received in the range (default: all), oldest first. */
  async registerCsv(q: RegisterQuery): Promise<string> {
    const rows = await this.prisma.supportTicket.findMany({
      where: q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {},
      include: { order: { select: { number: true } }, request: { select: { number: true } } },
      orderBy: { createdAt: 'asc' },
      take: 10_000,
    });
    const iso = (d: Date | null) => (d ? d.toISOString() : '');
    const lines = [REGISTER_HEAD.join(',')];
    for (const t of rows) {
      lines.push(
        [
          t.number, t.kind, t.channel, t.category, iso(t.createdAt), iso(t.ackedAt), iso(t.recordCopySentAt), iso(t.firstResponseAt), dateFormat.format(t.resolveDueAt), iso(t.resolvedAt), t.status,
          t.order?.number ?? t.request?.number ?? '', t.resolutionNote ?? '',
        ]
          .map((c) => csvCell(String(c)))
          .join(','),
      );
    }
    return `${lines.join('\n')}\n`;
  }
}
