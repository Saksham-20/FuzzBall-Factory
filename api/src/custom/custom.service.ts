import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { AppException, badRequest, notFound, validationFailed } from '../common/errors.js';
import type { RequestUser } from '../common/types/auth.types.js';
import { NumberingService } from '../common/numbering.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PAYMENTS_PORT, type CheckoutPayment, type PaidEvent, type PaymentsPort } from '../payments/payments.types.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CustomStateService, type Notice } from './custom-state.service.js';
import { balanceAmount, depositAmount, isQuoteExpired, MAX_COUNTERS, revisionExceeded, rupees } from './custom.rules.js';
import { customInclude, toCustomRequestDto, type CustomRequestDto, type CustomRow } from './custom.mapper.js';
import type { CounterDto, CreateCustomDto, DeclineQuoteDto, MessageDto, RequestChangeDto } from './dto/custom.dto.js';
import { QuoteExpiryService } from './quote-expiry.service.js';

const NOT_FOUND = "We couldn't find that work order.";
const WRONG_STAGE = "That isn't possible at this stage of the work order.";
const QUOTE_CLOSED = "That quote isn't open any more.";
const QUOTE_EXPIRED = 'This quote has expired. Message us to reopen it.';

/** Earliest deadline we accept, with a day of slack so a shopper in another time zone isn't rejected. */
const MIN_NEEDED_BY_DAYS = 6;

/**
 * Customer side of custom work orders. All status changes go through CustomStateService; this class
 * validates, scopes everything to the owner (other people's work orders are a 404) and talks to payments.
 */
@Injectable()
export class CustomService implements OnModuleInit {
  private readonly logger = new Logger(CustomService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly state: CustomStateService,
    private readonly expiry: QuoteExpiryService,
    private readonly numbering: NumberingService,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENTS_PORT) private readonly payments: PaymentsPort,
  ) {}

  onModuleInit(): void {
    this.payments.registerPaidHandler('DEPOSIT', (event, tx) => this.onDepositPaid(event, tx));
    this.payments.registerPaidHandler('BALANCE', (event, tx) => this.onBalancePaid(event, tx));
    // PaymentsService also offers a post-commit hook: use it to send the email once the payment really committed.
    const withListener = this.payments as PaymentsPort & { registerPaidListener?: (purpose: 'DEPOSIT' | 'BALANCE', l: (e: PaidEvent) => Promise<void>) => void };
    this.hasCommitHook = typeof withListener.registerPaidListener === 'function';
    withListener.registerPaidListener?.('DEPOSIT', (event) => this.flushPending(event));
  }

  /** Notices prepared inside the payments transaction, keyed by payment id, sent by the post-commit listener. */
  private readonly pending = new Map<string, Notice>();
  private hasCommitHook = false;

  private async flushPending(event: PaidEvent): Promise<void> {
    const notice = this.pending.get(event.paymentId);
    this.pending.delete(event.paymentId);
    await this.state.dispatch(notice);
  }

  /* ───────────── reads ───────────── */

  async list(user: RequestUser): Promise<CustomRequestDto[]> {
    await this.expiry.sweep(user.userId);
    const rows = await this.prisma.customRequest.findMany({ where: { userId: user.userId }, include: customInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    return rows.map(toCustomRequestDto);
  }

  /** Owner or admin. Everyone else gets a 404 (never confirm that someone else's work order exists). */
  async get(user: RequestUser, number: string): Promise<CustomRequestDto> {
    const row = await this.load(number, user, { allowAdmin: true });
    if (await this.expiry.expireIfDue(row)) return toCustomRequestDto(await this.load(number, user, { allowAdmin: true }));
    return toCustomRequestDto(row);
  }

  /* ───────────── create ───────────── */

  async create(user: RequestUser, dto: CreateCustomDto): Promise<CustomRequestDto> {
    const [category, account] = await Promise.all([
      this.prisma.category.findUnique({ where: { slug: dto.category }, select: { slug: true } }),
      this.prisma.user.findUnique({ where: { id: user.userId }, select: { id: true, name: true, email: true } }),
    ]);
    if (!account) throw notFound(NOT_FOUND);

    const fields: Record<string, string> = {};
    if (!category) fields.category = 'Pick the closest category.';
    if (dto.budgetMax < dto.budgetMin) fields.budgetMax = 'The most has to be at least the least.';
    if (dto.country === 'IN' && !/^[1-9][0-9]{5}$/.test(dto.postalCode)) fields.postalCode = 'Enter a valid 6-digit pincode.';
    if (dto.country !== 'IN' && dto.postalCode.length < 3) fields.postalCode = 'Enter your postal code.';
    if (dto.termsAccepted === false) fields.termsAccepted = 'Tick this box to confirm you have read the terms.';

    let neededBy: Date | undefined;
    if (dto.neededBy) {
      neededBy = new Date(dto.neededBy);
      const earliest = new Date();
      earliest.setUTCHours(0, 0, 0, 0);
      earliest.setUTCDate(earliest.getUTCDate() + MIN_NEEDED_BY_DAYS);
      if (Number.isNaN(neededBy.getTime())) fields.neededBy = 'Use a date like 2026-12-31';
      else if (neededBy < earliest) fields.neededBy = 'Pick a date at least 7 days from today.';
    }

    let baseProductId: string | undefined;
    if (dto.kind === 'CUSTOMIZE') {
      const base = dto.baseProductSlug ? await this.prisma.product.findUnique({ where: { slug: dto.baseProductSlug }, select: { id: true, customizable: true, status: true } }) : null;
      if (!base || base.status === 'ARCHIVED') fields.baseProductSlug = 'We could not find that product.';
      else if (!base.customizable) fields.baseProductSlug = 'That piece cannot be customised. Start a new work order instead.';
      else baseProductId = base.id;
    } else if (dto.baseProductSlug) {
      fields.baseProductSlug = 'Only used when customising a piece from the shelf.';
    }
    if (Object.keys(fields).length > 0) throw validationFailed(fields);

    const now = new Date();
    const created = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.nextWorkOrderNumber(tx);
      return tx.customRequest.create({
        data: {
          number,
          userId: account.id,
          customerName: account.name,
          customerPhone: dto.phone,
          kind: dto.kind,
          baseProductId,
          category: dto.category,
          title: dto.title,
          description: dto.description,
          colours: dto.colours,
          size: dto.size,
          quantity: dto.quantity,
          budgetMin: dto.budgetMin,
          budgetMax: dto.budgetMax,
          neededBy,
          occasion: dto.occasion,
          personalization: dto.personalization,
          country: dto.country,
          postalCode: dto.postalCode,
          termsAcceptedAt: now,
          images: { create: dto.references.map((url, sortOrder) => ({ url, sortOrder })) },
          events: { create: { status: 'REQUESTED', note: 'Work order sent.', actorId: account.id, at: now } },
        },
        include: customInclude,
      });
    });

    await this.notifications.send('workorder.received', {
      to: account.email,
      name: account.name,
      workOrderNumber: created.number,
      title: created.title,
      url: this.state.webUrl(`/account/custom/${created.number}`),
    });
    return toCustomRequestDto(created);
  }

  /* ───────────── conversation ───────────── */

  async addMessage(user: RequestUser, number: string, dto: MessageDto): Promise<CustomRequestDto> {
    const row = await this.load(number, user);
    await this.prisma.customMessage.create({ data: { requestId: row.id, author: 'customer', body: dto.body, attachments: dto.attachments ?? [] } });
    return this.reload(row.id);
  }

  /* ───────────── the quote ───────────── */

  /** Accept the live quote: QUOTED → ACCEPTED → DEPOSIT_PENDING. Payment is a separate call (`payDeposit`). */
  async acceptQuote(user: RequestUser, number: string, quoteId: string): Promise<CustomRequestDto> {
    const row = await this.load(number, user);
    const quote = await this.openQuote(row, quoteId, ['SENT']);
    await this.state.withTransaction(async (tx, collect) => {
      const { count } = await tx.quote.updateMany({ where: { id: quote.id, status: 'SENT' }, data: { status: 'ACCEPTED' } });
      if (count !== 1) throw badRequest(QUOTE_CLOSED);
      const deposit = depositAmount(quote);
      collect(
        await this.state.move(
          tx,
          row.id,
          [
            { to: 'ACCEPTED', note: `Quote accepted: ${rupees(quote.price)}.` },
            { to: 'DEPOSIT_PENDING', note: `Deposit of ${rupees(deposit)} due to start your piece.` },
          ],
          { actorId: user.userId },
        ),
      );
    });
    return this.reload(row.id);
  }

  /** Counter-offer: at most MAX_COUNTERS per work order, and always lower than the quote. */
  async counterQuote(user: RequestUser, number: string, quoteId: string, dto: CounterDto): Promise<CustomRequestDto> {
    const row = await this.load(number, user);
    const quote = await this.openQuote(row, quoteId, ['SENT']);
    if (countersUsed(row) >= MAX_COUNTERS) throw badRequest(`You can counter up to ${MAX_COUNTERS} times. Accept, decline, or message us.`);
    if (dto.amount >= quote.price) throw badRequest('A counter-offer has to be lower than the quote.', { amount: 'Must be lower than the quote' });

    await this.state.withTransaction(async (tx, collect) => {
      const { count } = await tx.quote.updateMany({
        where: { id: quote.id, status: 'SENT' },
        data: { status: 'COUNTERED', counterAmount: dto.amount, counterNote: dto.note ?? '', counterAt: new Date() },
      });
      if (count !== 1) throw badRequest(QUOTE_CLOSED);
      collect(await this.state.move(tx, row.id, [{ to: 'COUNTERED', note: `Counter-offer sent: ${rupees(dto.amount)}.` }], { actorId: user.userId }));
    });
    return this.reload(row.id);
  }

  /** The customer walks away from the quote: the work order is CANCELLED (the maker declining is DECLINED). */
  async declineQuote(user: RequestUser, number: string, quoteId: string, dto: DeclineQuoteDto): Promise<CustomRequestDto> {
    const row = await this.load(number, user);
    if (row.status !== 'QUOTED' && row.status !== 'COUNTERED') throw badRequest(WRONG_STAGE);
    const quote = row.quotes.find((q) => q.id === quoteId);
    if (!quote || (quote.status !== 'SENT' && quote.status !== 'COUNTERED')) throw badRequest(QUOTE_CLOSED);
    await this.state.withTransaction(async (tx, collect) => {
      await tx.quote.update({ where: { id: quote.id }, data: { status: 'DECLINED' } });
      collect(await this.state.move(tx, row.id, [{ to: 'CANCELLED', note: dto.reason ? `Quote declined: ${dto.reason}` : 'Quote declined.' }], { actorId: user.userId }));
    });
    return this.reload(row.id);
  }

  /* ───────────── delivery of the piece ───────────── */

  async approveFinal(user: RequestUser, number: string): Promise<CustomRequestDto> {
    const row = await this.load(number, user);
    if (row.status !== 'AWAITING_APPROVAL') throw badRequest(WRONG_STAGE);
    const quote = acceptedQuote(row);
    await this.state.withTransaction(async (tx, collect) => {
      collect(
        await this.state.move(tx, row.id, [{ to: 'BALANCE_PENDING', note: quote ? `Approved. Balance of ${rupees(balanceAmount(quote))} due before shipping.` : 'Approved.' }], { actorId: user.userId }),
      );
    });
    return this.reload(row.id);
  }

  /**
   * Ask for a change to the finished piece. Goes back to IN_PROGRESS. Beyond the revisions included in the
   * quote `extraCharge` is true: the maker may charge for it, and the customer is told up front.
   */
  async requestChange(user: RequestUser, number: string, dto: RequestChangeDto): Promise<CustomRequestDto & { extraCharge: boolean }> {
    const row = await this.load(number, user);
    if (row.status !== 'AWAITING_APPROVAL') throw badRequest(WRONG_STAGE);
    const quote = acceptedQuote(row);
    const used = row.events.filter((e) => e.status === 'CHANGE_REQUESTED').length;
    const extraCharge = !!quote && revisionExceeded(used, quote.revisions);
    await this.state.withTransaction(async (tx, collect) => {
      await tx.customMessage.create({ data: { requestId: row.id, author: 'customer', body: `Change requested: ${dto.note}` } });
      collect(await this.state.move(tx, row.id, [{ to: 'IN_PROGRESS', eventStatus: 'CHANGE_REQUESTED', note: dto.note }], { actorId: user.userId, notify: false }));
    });
    return { ...(await this.reload(row.id)), extraCharge };
  }

  /* ───────────── payments ───────────── */

  /** Starts the deposit payment for an accepted quote. The status moves on when the payment is captured. */
  async payDeposit(user: RequestUser, number: string): Promise<CheckoutPayment> {
    const row = await this.load(number, user);
    if (row.status !== 'DEPOSIT_PENDING') throw badRequest(WRONG_STAGE);
    const quote = acceptedQuote(row);
    if (!quote) throw badRequest(QUOTE_CLOSED);
    return this.startPayment(user, row, quote.id, 'DEPOSIT', depositAmount(quote), `${row.number}-deposit`);
  }

  async payBalance(user: RequestUser, number: string): Promise<CheckoutPayment> {
    const row = await this.load(number, user);
    if (row.status !== 'BALANCE_PENDING') throw badRequest(WRONG_STAGE);
    const quote = acceptedQuote(row);
    if (!quote) throw badRequest(QUOTE_CLOSED);
    return this.startPayment(user, row, quote.id, 'BALANCE', balanceAmount(quote), `${row.number}-balance`);
  }

  private async startPayment(user: RequestUser, row: CustomRow, quoteId: string, purpose: 'DEPOSIT' | 'BALANCE', amount: number, receipt: string): Promise<CheckoutPayment> {
    const payment = await this.payments.createPayment({ purpose, amount, customRequestId: row.id, userId: user.userId, receipt });
    // The payments contract has no quote id: attach it so finance can trace which quote a payment settled.
    await this.prisma.payment.update({ where: { id: payment.paymentId }, data: { quoteId } }).catch((err: Error) => this.logger.warn(`Could not link payment ${payment.paymentId} to quote: ${err.message}`));
    return payment;
  }

  /** Runs inside the payments transaction that marks the deposit PAID. Idempotent. */
  private async onDepositPaid(event: PaidEvent, tx: Prisma.TransactionClient): Promise<void> {
    if (!event.customRequestId) return;
    const row = await tx.customRequest.findUnique({ where: { id: event.customRequestId }, select: { status: true } });
    if (!row) {
      this.logger.warn(`Deposit ${event.paymentId} paid for a missing work order ${event.customRequestId}`);
      return;
    }
    if (row.status !== 'DEPOSIT_PENDING') {
      if (row.status !== 'IN_QUEUE' && row.status !== 'IN_PROGRESS') this.logger.warn(`Deposit ${event.paymentId} paid while ${event.customRequestId} is ${row.status}: needs a manual look`);
      return;
    }
    const notice = await this.state.move(tx, event.customRequestId, [{ to: 'IN_PROGRESS', note: "Deposit received. We're starting your piece." }]);
    if (!notice) return;
    if (this.hasCommitHook) this.pending.set(event.paymentId, notice);
    else this.state.dispatchWhenCommitted(notice);
  }

  private async onBalancePaid(event: PaidEvent, tx: Prisma.TransactionClient): Promise<void> {
    if (!event.customRequestId) return;
    const row = await tx.customRequest.findUnique({ where: { id: event.customRequestId }, select: { status: true } });
    if (!row) {
      this.logger.warn(`Balance ${event.paymentId} paid for a missing work order ${event.customRequestId}`);
      return;
    }
    if (row.status !== 'BALANCE_PENDING') {
      if (!['READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CLOSED'].includes(row.status)) this.logger.warn(`Balance ${event.paymentId} paid while ${event.customRequestId} is ${row.status}: needs a manual look`);
      return;
    }
    await this.state.move(tx, event.customRequestId, [{ to: 'READY_TO_SHIP', note: "Paid in full. We'll ship it soon." }], { notify: false });
  }

  /* ───────────── helpers ───────────── */

  private async reload(id: string): Promise<CustomRequestDto> {
    const row = await this.prisma.customRequest.findUnique({ where: { id }, include: customInclude });
    if (!row) throw notFound(NOT_FOUND);
    return toCustomRequestDto(row);
  }

  private async load(number: string, user: RequestUser, opts: { allowAdmin?: boolean } = {}): Promise<CustomRow> {
    const row = await this.prisma.customRequest.findUnique({ where: { number }, include: customInclude });
    const visible = row && (row.userId === user.userId || (opts.allowAdmin && user.role === 'admin'));
    if (!row || !visible) throw notFound(NOT_FOUND);
    return row;
  }

  /**
   * The quote the customer is acting on. Enforces: work order is QUOTED, the quote exists and is still open,
   * and it hasn't expired (410, and the work order flips to EXPIRED as a side effect).
   */
  private async openQuote(row: CustomRow, quoteId: string, ok: ('SENT' | 'COUNTERED')[]): Promise<CustomRow['quotes'][number]> {
    if (row.status === 'EXPIRED') throw new AppException(410, 'QUOTE_EXPIRED', QUOTE_EXPIRED);
    if (row.status !== 'QUOTED') throw badRequest(WRONG_STAGE);
    const quote = row.quotes.find((q) => q.id === quoteId);
    if (!quote || !ok.includes(quote.status as 'SENT' | 'COUNTERED')) throw badRequest(QUOTE_CLOSED);
    if (isQuoteExpired(quote)) {
      await this.expiry.expire(row.id);
      throw new AppException(410, 'QUOTE_EXPIRED', QUOTE_EXPIRED);
    }
    return quote;
  }
}

/** Counter-offers made so far (the web derives the same number from the timeline). */
export const countersUsed = (row: Pick<CustomRow, 'events'>): number => row.events.filter((e) => e.status === 'COUNTERED').length;

/** The accepted quote, i.e. the agreed price. */
export const acceptedQuote = (row: Pick<CustomRow, 'quotes'>) => [...row.quotes].reverse().find((q) => q.status === 'ACCEPTED');
