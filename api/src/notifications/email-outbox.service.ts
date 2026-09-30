import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { reportError } from '../common/error-reporter.js';
import { badRequest, notFound } from '../common/errors.js';
import type { Env } from '../config/env.js';
import type { EmailStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailProvider } from './email.provider.js';
import type { NotificationEvent, NotificationEventMap, TemplateContext } from './events.js';
import { renderTemplate } from './templates/registry.js';

/** Pause after failed attempt N (1-based). The attempt after the last pause is final. */
const BACKOFF_MINUTES = [1, 5, 15, 60, 240];
/** A password-reset link is only good for minutes: retry briefly, then stop. */
const SHORT_LIVED: readonly NotificationEvent[] = ['auth.password_reset'];
const SHORT_LIVED_BACKOFF_MINUTES = [1];
/** A row stuck SENDING longer than this belonged to a process that died: pick it up again. */
const LEASE_MS = 3 * 60_000;

const backoffFor = (event: string) => (SHORT_LIVED.includes(event as NotificationEvent) ? SHORT_LIVED_BACKOFF_MINUTES : BACKOFF_MINUTES);

export interface OutboxRow {
  id: string;
  event: string;
  to: string;
  status: EmailStatus;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  sentAt: Date | null;
  /** False once the payload has been emptied (sent, or a short-lived email that gave up): it cannot be resent. */
  resendable: boolean;
}

const toOutboxRow = (r: { id: string; event: string; toEmail: string; status: EmailStatus; attempts: number; lastError: string | null; createdAt: Date; sentAt: Date | null; payload: unknown }): OutboxRow => ({
  id: r.id,
  event: r.event,
  to: r.toEmail,
  status: r.status,
  attempts: r.attempts,
  lastError: r.lastError,
  createdAt: r.createdAt,
  sentAt: r.sentAt,
  resendable: Object.keys((r.payload ?? {}) as object).length > 0,
});

/**
 * Durable email delivery. `enqueue` writes the message down, `deliver` sends it, and anything that fails for a
 * reason a retry can fix goes back to PENDING with a backoff for the scheduler (`processDue`). After the last attempt
 * the row is FAILED (a dead letter the admin can see and resend) and Sentry hears about it.
 */
@Injectable()
export class EmailOutboxService {
  private readonly logger = new Logger(EmailOutboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailProvider,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async enqueue<E extends NotificationEvent>(event: E, payload: NotificationEventMap[E]): Promise<string> {
    const row = await this.prisma.emailOutbox.create({ data: { event, toEmail: payload.to, payload: payload as never }, select: { id: true } });
    return row.id;
  }

  /** Sends one row now. Returns its final state for this attempt; never throws. */
  async deliver(id: string): Promise<'SENT' | 'RETRY' | 'FAILED' | 'SKIPPED'> {
    const now = new Date();
    const claimed = await this.prisma.emailOutbox.updateMany({
      where: { id, OR: [{ status: 'PENDING' }, { status: 'SENDING', lockedUntil: { lt: now } }] },
      data: { status: 'SENDING', lockedUntil: new Date(now.getTime() + LEASE_MS), attempts: { increment: 1 } },
    });
    if (claimed.count === 0) return 'SKIPPED'; // someone else has it, or it is already done
    const row = await this.prisma.emailOutbox.findUniqueOrThrow({ where: { id } });

    let rendered;
    try {
      rendered = renderTemplate(row.event as NotificationEvent, row.payload as never, this.context());
    } catch (err) {
      // A template that cannot render will not render next time either.
      return this.fail(row, `Could not render: ${(err as Error).message}`, { permanent: true });
    }
    try {
      const result = await this.email.send({ to: row.toEmail, ...rendered });
      await this.prisma.emailOutbox.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date(), lockedUntil: null, lastError: null, providerId: result.id ?? null, payload: {} },
      });
      return 'SENT';
    } catch (err) {
      return this.fail(row, (err as Error).message);
    }
  }

  private async fail(row: { id: string; event: string; toEmail: string; attempts: number }, message: string, opts: { permanent?: boolean } = {}) {
    const pauses = backoffFor(row.event);
    const lastError = message.slice(0, 500);
    if (opts.permanent || row.attempts > pauses.length) {
      await this.prisma.emailOutbox.update({
        where: { id: row.id },
        data: { status: 'FAILED', lockedUntil: null, lastError, ...(SHORT_LIVED.includes(row.event as NotificationEvent) ? { payload: {} } : {}) },
      });
      this.logger.error(`[EMAIL FAILED] "${row.event}" to ${row.toEmail} gave up after ${row.attempts} attempt(s): ${lastError}`);
      reportError(new Error(`Email gave up: ${lastError}`), { area: 'email', extra: { outboxId: row.id, event: row.event, attempts: row.attempts } });
      return 'FAILED' as const;
    }
    const minutes = pauses[row.attempts - 1] ?? pauses[pauses.length - 1]!;
    await this.prisma.emailOutbox.update({ where: { id: row.id }, data: { status: 'PENDING', lockedUntil: null, lastError, nextAttemptAt: new Date(Date.now() + minutes * 60_000) } });
    this.logger.warn(`Email "${row.event}" to ${row.toEmail} attempt ${row.attempts} failed (${lastError}); retrying in ${minutes} min`);
    return 'RETRY' as const;
  }

  /** Scheduler entry: sends every row that is due (or whose worker died). Returns how many went out. */
  async processDue(limit = 50): Promise<number> {
    const now = new Date();
    const due = await this.prisma.emailOutbox.findMany({
      where: { OR: [{ status: 'PENDING', nextAttemptAt: { lte: now } }, { status: 'SENDING', lockedUntil: { lt: now } }] },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
      select: { id: true },
    });
    let sent = 0;
    for (const { id } of due) if ((await this.deliver(id)) === 'SENT') sent += 1;
    return sent;
  }

  /* ───────────── admin ───────────── */

  async list(status?: EmailStatus, limit = 100): Promise<OutboxRow[]> {
    const rows = await this.prisma.emailOutbox.findMany({
      where: status ? { status } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.min(limit, 200),
    });
    return rows.map(toOutboxRow);
  }

  /** Puts a FAILED email back in the queue, with a fresh set of attempts, and sends it now. */
  async retry(id: string): Promise<OutboxRow> {
    const row = await this.prisma.emailOutbox.findUnique({ where: { id } });
    if (!row) throw notFound('That email is not in the outbox.');
    if (row.status !== 'FAILED') throw badRequest('Only an email that gave up can be resent.');
    if (Object.keys((row.payload ?? {}) as object).length === 0) throw badRequest('This email cannot be resent: its content was cleared.');
    await this.prisma.emailOutbox.update({ where: { id }, data: { status: 'PENDING', attempts: 0, nextAttemptAt: new Date(), lockedUntil: null } });
    await this.deliver(id);
    return toOutboxRow(await this.prisma.emailOutbox.findUniqueOrThrow({ where: { id } }));
  }

  private context(): TemplateContext {
    const from = this.config.get('MAIL_FROM', { infer: true });
    const supportEmail = /<([^>]+)>/.exec(from)?.[1];
    return { brandName: 'FuzzBall Factory', supportEmail, whatsappNumber: this.config.get('WHATSAPP_NUMBER', { infer: true }) };
  }
}
