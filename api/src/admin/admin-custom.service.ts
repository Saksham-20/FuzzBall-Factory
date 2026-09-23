import { Injectable } from '@nestjs/common';
import { badRequest, notFound } from '../common/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { CustomStateService } from '../custom/custom-state.service.js';
import { DECLINABLE, QUOTABLE } from '../custom/custom-transitions.js';
import { customInclude, toCustomRequestDto, type CustomRequestDto, type CustomRow } from '../custom/custom.mapper.js';
import { addDays, depositAmount, priceFromBreakdown, rupees, scaleBreakdown } from '../custom/custom.rules.js';
import type { QuoteInputDto } from '../custom/dto/custom.dto.js';
import { QuoteExpiryService } from '../custom/quote-expiry.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { AuditService } from './audit.service.js';
import type { AdminMessageDto, ApprovalRequestDto, DeclineCustomDto, ProgressDto, ShipCustomDto } from './dto/admin-custom.dto.js';

export interface AdminCtx {
  actorId: string;
  ip?: string;
}

const NOT_FOUND = 'Work order not found.';

/** The maker's side of a work order. Every method is one transaction: change + timeline event + audit row. */
@Injectable()
export class AdminCustomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly state: CustomStateService,
    private readonly expiry: QuoteExpiryService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  async list(status?: string): Promise<CustomRequestDto[]> {
    await this.expiry.sweep();
    const rows = await this.prisma.customRequest.findMany({
      where: status ? { status: status as CustomRow['status'] } : {},
      include: customInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
    return rows.map(toCustomRequestDto);
  }

  async get(number: string): Promise<CustomRequestDto> {
    const row = await this.load(number);
    if (await this.expiry.expireIfDue(row)) return toCustomRequestDto(await this.load(number));
    return toCustomRequestDto(row);
  }

  /** Sends (or re-sends after a counter/expiry) a quote. Deposit % is snapshotted from settings right now. */
  async sendQuote(ctx: AdminCtx, number: string, dto: QuoteInputDto): Promise<CustomRequestDto> {
    const row = await this.load(number);
    if (!QUOTABLE.includes(row.status)) throw badRequest("This work order can't be quoted right now.");
    const price = priceFromBreakdown(dto.breakdown);
    const settings = await this.settings.getStoreSettings();
    const validUntil = addDays(new Date(), dto.validDays ?? settings.quoteValidityDays);

    await this.state.withTransaction(async (tx, collect) => {
      // Any earlier open quote is superseded.
      await tx.quote.updateMany({ where: { requestId: row.id, status: { in: ['SENT', 'COUNTERED'] } }, data: { status: 'DECLINED' } });
      const quote = await tx.quote.create({
        data: {
          requestId: row.id,
          price,
          depositPct: settings.depositPct,
          breakdown: dto.breakdown.map((l) => ({ label: l.label, amount: l.amount })),
          timelineDays: dto.timelineDays,
          revisions: dto.revisions,
          scope: dto.scope,
          validUntil,
        },
      });
      collect(await this.state.move(tx, row.id, [{ to: 'QUOTED', note: `Quote sent: ${rupees(price)}.` }], { actorId: ctx.actorId }));
      await this.log(tx, ctx, 'custom.quote', row.number, { quoteId: quote.id, price, depositPct: settings.depositPct, resend: row.status !== 'REQUESTED' && row.status !== 'UNDER_REVIEW' });
    });
    return this.reload(row.id);
  }

  async decline(ctx: AdminCtx, number: string, dto: DeclineCustomDto): Promise<CustomRequestDto> {
    const row = await this.load(number);
    if (!DECLINABLE.includes(row.status)) throw badRequest("This work order can't be declined right now.");
    await this.state.withTransaction(async (tx, collect) => {
      await tx.quote.updateMany({ where: { requestId: row.id, status: { in: ['SENT', 'COUNTERED'] } }, data: { status: 'DECLINED' } });
      await tx.customMessage.create({ data: { requestId: row.id, author: 'maker', body: dto.reason } });
      collect(await this.state.move(tx, row.id, [{ to: 'DECLINED', note: dto.reason }], { actorId: ctx.actorId }));
      await this.log(tx, ctx, 'custom.decline', row.number, { reason: dto.reason });
    });
    return this.reload(row.id);
  }

  /** Accept the customer's counter-offer: the price becomes the counter and the deposit falls due. */
  async acceptCounter(ctx: AdminCtx, number: string): Promise<CustomRequestDto> {
    const row = await this.load(number);
    const quote = row.status === 'COUNTERED' ? [...row.quotes].reverse().find((q) => q.status === 'COUNTERED' && q.counterAmount != null) : undefined;
    if (!quote || quote.counterAmount == null) throw badRequest("There's no counter-offer to accept.");
    const price = quote.counterAmount;
    const breakdown = scaleBreakdown(
      (quote.breakdown as { label: string; amount: number }[]) ?? [],
      quote.price,
      price,
    );
    await this.state.withTransaction(async (tx, collect) => {
      const { count } = await tx.quote.updateMany({ where: { id: quote.id, status: 'COUNTERED' }, data: { status: 'ACCEPTED', price, breakdown: breakdown as unknown as Prisma.InputJsonValue } });
      if (count !== 1) throw badRequest("There's no counter-offer to accept.");
      collect(
        await this.state.move(
          tx,
          row.id,
          [
            { to: 'ACCEPTED', note: `Counter-offer accepted: ${rupees(price)}.` },
            { to: 'DEPOSIT_PENDING', note: `Deposit of ${rupees(depositAmount({ price, depositPct: quote.depositPct }))} due to start your piece.` },
          ],
          { actorId: ctx.actorId },
        ),
      );
      await this.log(tx, ctx, 'custom.accept_counter', row.number, { quoteId: quote.id, from: quote.price, to: price });
    });
    return this.reload(row.id);
  }

  async markUnderReview(ctx: AdminCtx, number: string): Promise<CustomRequestDto> {
    const row = await this.load(number);
    if (row.status !== 'REQUESTED') throw badRequest('Only new work orders can be marked under review.');
    await this.state.withTransaction(async (tx, collect) => {
      collect(await this.state.move(tx, row.id, [{ to: 'UNDER_REVIEW', note: 'Looking at your idea.' }], { actorId: ctx.actorId, notify: false }));
      await this.log(tx, ctx, 'custom.under_review', row.number);
    });
    return this.reload(row.id);
  }

  async message(ctx: AdminCtx, number: string, dto: AdminMessageDto): Promise<CustomRequestDto> {
    const row = await this.load(number);
    await this.prisma.$transaction(async (tx) => {
      await tx.customMessage.create({ data: { requestId: row.id, author: 'maker', body: dto.body, attachments: dto.attachments ?? [] } });
      await this.log(tx, ctx, 'custom.message', row.number);
    });
    return this.reload(row.id);
  }

  /** A progress note/photo on the timeline. Only once the deposit is in; the first one starts the work. */
  async addProgress(ctx: AdminCtx, number: string, dto: ProgressDto): Promise<CustomRequestDto> {
    const row = await this.load(number);
    if (row.status !== 'IN_QUEUE' && row.status !== 'IN_PROGRESS') throw badRequest('Progress can be added once the deposit has been paid.');
    await this.state.withTransaction(async (tx, collect) => {
      if (row.status === 'IN_QUEUE') {
        collect(await this.state.move(tx, row.id, [{ to: 'IN_PROGRESS', note: dto.note, photo: dto.photo }], { actorId: ctx.actorId, notify: 'workorder.progress' }));
      } else {
        collect(await this.state.record(tx, row.id, { eventStatus: 'IN_PROGRESS', note: dto.note, photo: dto.photo, actorId: ctx.actorId, notify: 'workorder.progress' }));
      }
      await this.log(tx, ctx, 'custom.progress', row.number, { photo: dto.photo ?? null });
    });
    return this.reload(row.id);
  }

  async requestApproval(ctx: AdminCtx, number: string, dto: ApprovalRequestDto): Promise<CustomRequestDto> {
    const row = await this.load(number);
    if (row.status !== 'IN_PROGRESS') throw badRequest('Only pieces in progress can be sent for approval.');
    await this.state.withTransaction(async (tx, collect) => {
      collect(await this.state.move(tx, row.id, [{ to: 'AWAITING_APPROVAL', note: dto.note ?? 'Your finished piece is ready for approval.', photo: dto.photo }], { actorId: ctx.actorId }));
      await this.log(tx, ctx, 'custom.request_approval', row.number);
    });
    return this.reload(row.id);
  }

  async markShipped(ctx: AdminCtx, number: string, dto: ShipCustomDto): Promise<CustomRequestDto> {
    const row = await this.load(number);
    if (row.status !== 'READY_TO_SHIP') throw badRequest('Ship after the balance is paid.');
    await this.state.withTransaction(async (tx, collect) => {
      collect(
        await this.state.move(tx, row.id, [{ to: 'SHIPPED', note: `Handed to ${dto.courier}. AWB ${dto.awb}.` }], {
          actorId: ctx.actorId,
          data: { courier: dto.courier, awb: dto.awb },
        }),
      );
      await this.log(tx, ctx, 'custom.ship', row.number, { courier: dto.courier, awb: dto.awb });
    });
    return this.reload(row.id);
  }

  async markDelivered(ctx: AdminCtx, number: string): Promise<CustomRequestDto> {
    const row = await this.load(number);
    if (row.status !== 'SHIPPED') throw badRequest('Only shipped work orders can be marked delivered.');
    await this.state.withTransaction(async (tx, collect) => {
      collect(await this.state.move(tx, row.id, [{ to: 'DELIVERED', note: 'Delivered.' }], { actorId: ctx.actorId, notify: false }));
      await this.log(tx, ctx, 'custom.deliver', row.number);
    });
    return this.reload(row.id);
  }

  private log(tx: Prisma.TransactionClient, ctx: AdminCtx, action: string, entityId: string, meta?: Prisma.InputJsonValue) {
    return this.audit.log({ actorId: ctx.actorId, action, entity: 'CustomRequest', entityId, meta, ip: ctx.ip }, tx);
  }

  private async load(number: string): Promise<CustomRow> {
    const row = await this.prisma.customRequest.findUnique({ where: { number }, include: customInclude });
    if (!row) throw notFound(NOT_FOUND);
    return row;
  }

  private async reload(id: string): Promise<CustomRequestDto> {
    const row = await this.prisma.customRequest.findUnique({ where: { id }, include: customInclude });
    if (!row) throw notFound(NOT_FOUND);
    return toCustomRequestDto(row);
  }
}
