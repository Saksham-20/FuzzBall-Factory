import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { conflict, invalidTransition, notFound } from '../common/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { CustomStatus } from '../generated/prisma/enums.js';
import type { NotificationEvent, NotificationEventMap } from '../notifications/events.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { canTransition } from './custom-transitions.js';
import { balanceAmount, depositAmount } from './custom.rules.js';

/** One hop in a transition path. `eventStatus` overrides the timeline label (e.g. `CHANGE_REQUESTED`). */
export interface Step {
  to: CustomStatus;
  note?: string;
  photo?: string;
  eventStatus?: string;
}

export interface MoveOptions {
  /** Who did it (admin/customer id); null/undefined for the system or a payment webhook. */
  actorId?: string;
  /** Extra columns written together with the final status (courier, awb…). */
  data?: Prisma.CustomRequestUpdateManyMutationInput;
  /** Force a notification event, or `false` to send none. Default: derived from the target status. */
  notify?: NotificationEvent | false;
}

/** A notification prepared inside a transaction, to be sent after it commits. */
export interface Notice {
  event: NotificationEvent;
  payload: NotificationEventMap[NotificationEvent];
  /** Id of the last timeline event written: used to confirm the transaction really committed. */
  eventId: string;
}

type Tx = Prisma.TransactionClient;

/**
 * The ONLY place a work order's status changes. Every hop: (a) is checked against CUSTOM_TRANSITIONS
 * (409 otherwise), (b) is applied with an optimistic `updateMany … where status = <from>` so two requests
 * racing on the same work order cannot both win, (c) writes a `CustomEvent`. Notifications are built inside
 * the transaction but only sent after it commits (`dispatch`).
 */
@Injectable()
export class CustomStateService {
  private readonly logger = new Logger(CustomStateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
    private readonly settings: SettingsService,
  ) {}

  /** Transition in its own transaction and send the notification once it has committed. */
  async transition(requestId: string, to: CustomStatus, opts: MoveOptions & Omit<Step, 'to'> = {}): Promise<void> {
    const { note, photo, eventStatus, ...rest } = opts;
    const notice = await this.prisma.$transaction((tx) => this.move(tx, requestId, [{ to, note, photo, eventStatus }], rest));
    await this.dispatch(notice);
  }

  /**
   * Runs `fn` in one transaction; every `Notice` it collects is sent after the commit.
   * Use this when a use case needs several writes (quote rows, messages…) plus a transition, atomically.
   */
  async withTransaction<T>(fn: (tx: Tx, collect: (notice: Notice | undefined) => void) => Promise<T>): Promise<T> {
    const notices: Notice[] = [];
    const result = await this.prisma.$transaction((tx) => fn(tx, (n) => n && notices.push(n)));
    for (const n of notices) await this.dispatch(n);
    return result;
  }

  /**
   * Applies one or more hops inside the caller's transaction. Returns the notice for the LAST hop
   * (send it with `dispatch` after commit, or `dispatchWhenCommitted` if you don't control the commit).
   */
  async move(tx: Tx, requestId: string, steps: Step[], opts: MoveOptions = {}): Promise<Notice | undefined> {
    const row = await tx.customRequest.findUnique({ where: { id: requestId }, include: { user: { select: { email: true, name: true } } } });
    if (!row) throw notFound("We couldn't find that work order.");

    const from = row.status;
    let current = from;
    let lastEventId = '';
    const base = Date.now();
    for (const [i, step] of steps.entries()) {
      if (!canTransition(current, step.to)) throw invalidTransition(current, step.to);
      const last = i === steps.length - 1;
      const { count } = await tx.customRequest.updateMany({
        where: { id: requestId, status: current },
        data: { ...(last ? opts.data : {}), status: step.to },
      });
      if (count !== 1) throw conflict('This work order just changed. Please refresh and try again.');
      const event = await tx.customEvent.create({
        data: {
          requestId,
          status: step.eventStatus ?? step.to,
          note: step.note,
          photo: step.photo,
          actorId: opts.actorId,
          // Explicit, strictly increasing timestamps: several hops in one transaction keep their order.
          at: new Date(base + i),
        },
      });
      lastEventId = event.id;
      current = step.to;
    }

    const lastStep = steps[steps.length - 1];
    return this.buildNotice(tx, row, from, lastStep, lastEventId, opts.notify);
  }

  /**
   * Records a timeline entry without changing the status (progress photos, maker notes). Returns the
   * notice so the caller can send `workorder.progress`.
   */
  async record(tx: Tx, requestId: string, entry: { eventStatus: string; note?: string; photo?: string; actorId?: string; notify?: NotificationEvent | false }): Promise<Notice | undefined> {
    const row = await tx.customRequest.findUnique({ where: { id: requestId }, include: { user: { select: { email: true, name: true } } } });
    if (!row) throw notFound("We couldn't find that work order.");
    const event = await tx.customEvent.create({ data: { requestId, status: entry.eventStatus, note: entry.note, photo: entry.photo, actorId: entry.actorId } });
    if (entry.notify === false || !entry.notify) return undefined;
    return this.notice(entry.notify, row, { note: entry.note }, event.id);
  }

  /** Sends a prepared notice. Never throws (NotificationsService swallows provider errors). */
  async dispatch(notice: Notice | undefined): Promise<void> {
    if (!notice) return;
    await this.notifications.send(notice.event, notice.payload as never);
  }

  /**
   * For callers that don't own the transaction (the payments module runs our paid-handler inside its own):
   * wait until the timeline event we wrote is visible to other connections, i.e. the transaction committed,
   * then send. If it never appears (rolled back) nothing is sent.
   */
  dispatchWhenCommitted(notice: Notice | undefined): void {
    if (!notice) return;
    const delays = [150, 500, 1500, 4000, 10_000];
    const attempt = (i: number) => {
      setTimeout(() => {
        void this.prisma.customEvent
          .findUnique({ where: { id: notice.eventId }, select: { id: true } })
          .then((found) => {
            if (found) return this.dispatch(notice);
            if (i + 1 < delays.length) attempt(i + 1);
            else this.logger.warn(`Skipped ${notice.event}: its transaction did not commit`);
          })
          .catch((err: Error) => this.logger.error(`Could not confirm commit for ${notice.event}: ${err.message}`));
      }, delays[i]).unref();
    };
    attempt(0);
  }

  /* ───────────── notifications ───────────── */

  webUrl(path: string): string {
    const origin = this.config.get('WEB_ORIGIN', { infer: true }).split(',')[0].trim().replace(/\/$/, '');
    return `${origin}${path}`;
  }

  private notice(
    event: NotificationEvent,
    row: { number: string; title: string; user: { email: string; name: string } },
    extra: { amount?: number; note?: string; courier?: string; awb?: string; to?: string; name?: string; url?: string },
    eventId: string,
  ): Notice {
    return {
      event,
      eventId,
      payload: {
        to: extra.to ?? row.user.email,
        name: extra.name ?? row.user.name,
        workOrderNumber: row.number,
        title: row.title,
        url: extra.url ?? this.webUrl(`/account/custom/${row.number}`),
        ...(extra.amount != null ? { amount: extra.amount } : {}),
        ...(extra.note ? { note: extra.note } : {}),
        ...(extra.courier ? { courier: extra.courier } : {}),
        ...(extra.awb ? { awb: extra.awb } : {}),
      },
    };
  }

  private async buildNotice(
    tx: Tx,
    row: { id: string; number: string; title: string; user: { email: string; name: string } },
    from: CustomStatus,
    last: Step,
    eventId: string,
    override: NotificationEvent | false | undefined,
  ): Promise<Notice | undefined> {
    if (override === false) return undefined;
    const to = last.to;
    const event: NotificationEvent | undefined =
      override ??
      (to === 'QUOTED' ? 'workorder.quoted'
        : to === 'COUNTERED' ? 'workorder.countered'
        : to === 'DEPOSIT_PENDING' ? 'workorder.accepted'
        : to === 'IN_PROGRESS' && (from === 'DEPOSIT_PENDING' || from === 'IN_QUEUE') ? 'workorder.deposit_paid'
        : to === 'AWAITING_APPROVAL' ? 'workorder.awaiting_approval'
        : to === 'BALANCE_PENDING' ? 'workorder.balance_due'
        : to === 'SHIPPED' ? 'workorder.shipped'
        : to === 'DECLINED' ? 'workorder.declined'
        : undefined);
    if (!event) return undefined;

    // The quote this transition is about (the live one, or the one just accepted).
    const quote = await tx.quote.findFirst({
      where: { requestId: row.id, status: { in: ['SENT', 'COUNTERED', 'ACCEPTED'] } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    const amount =
      event === 'workorder.quoted' ? (quote?.price ?? undefined)
      : event === 'workorder.countered' ? (quote?.counterAmount ?? undefined)
      : event === 'workorder.accepted' || event === 'workorder.deposit_paid' ? (quote ? depositAmount(quote) : undefined)
      : event === 'workorder.balance_due' ? (quote ? balanceAmount(quote) : undefined)
      : undefined;
    const withNote = event === 'workorder.progress' || event === 'workorder.awaiting_approval' || event === 'workorder.declined';
    const shipping = event === 'workorder.shipped'
      ? await tx.customRequest.findUnique({ where: { id: row.id }, select: { courier: true, awb: true } })
      : null;

    // A counter-offer is news for the maker, not the customer.
    if (event === 'workorder.countered') {
      const settings = await this.settings.getStoreSettings(tx);
      return this.notice(event, row, {
        amount, note: last.note, to: settings.email, name: 'FuzzBall Factory',
        url: this.webUrl(`/admin/custom/${row.number}`),
      }, eventId);
    }
    return this.notice(event, row, { amount, note: withNote ? last.note : undefined, courier: shipping?.courier ?? undefined, awb: shipping?.awb ?? undefined }, eventId);
  }
}
