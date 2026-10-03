import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ErasureService } from '../account/erasure.service.js';
import { QuoteExpiryService } from '../custom/quote-expiry.service.js';
import { EmailOutboxService } from '../notifications/email-outbox.service.js';
import { IdempotencyService } from '../common/idempotency/idempotency.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { RefundsService } from '../payments/refunds.service.js';
import { JobRunner } from './job-runner.service.js';
import { UploadsService } from '../uploads/uploads.service.js';
import { SupportService } from '../support/support.service.js';
import { RetentionService } from './retention.service.js';

/** Every recurring job in one place. Each tick goes through `JobRunner` (one at a time, logged, never throws). */
@Injectable()
export class ScheduledJobs {
  constructor(
    private readonly runner: JobRunner,
    private readonly orders: OrdersService,
    private readonly idempotency: IdempotencyService,
    private readonly refunds: RefundsService,
    private readonly quotes: QuoteExpiryService,
    private readonly retention: RetentionService,
    private readonly emails: EmailOutboxService,
    private readonly uploads: UploadsService,
    private readonly erasure: ErasureService,
    private readonly support: SupportService,
  ) {}

  /** Releases stock held by online orders nobody paid within the payment window. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  sweepUnpaidOrders() {
    return this.runner.run('orders.sweep-unpaid', () => this.orders.expireUnpaidOrders());
  }

  /** Releases the stock held by cash-on-delivery orders the maker never confirmed. */
  @Cron(CronExpression.EVERY_HOUR)
  expireUnconfirmedCod() {
    return this.runner.run('orders.expire-cod', () => this.orders.expireUnconfirmedCod());
  }

  /** Sends every refund that is due to Razorpay (queued after a failure, or left half-done by a crashed process). */
  @Cron(CronExpression.EVERY_MINUTE)
  processRefunds() {
    return this.runner.run('refunds.process', () => this.refunds.processDue());
  }

  /** Drops expired Idempotency-Key rows. */
  @Cron('15 3 * * *')
  purgeIdempotencyKeys() {
    return this.runner.run('idempotency.purge', () => this.idempotency.purgeExpired());
  }

  /** Moves work orders whose open quote lapsed to EXPIRED (reads never do this; accepting an expired quote is refused regardless). */
  @Cron(CronExpression.EVERY_5_MINUTES)
  expireQuotes() {
    return this.runner.run('custom.expire-quotes', () => this.quotes.sweep());
  }

  /** Drops long-expired refresh and password-reset tokens. */
  @Cron('30 3 * * *')
  purgeAuthTokens() {
    return this.runner.run('auth.purge-tokens', () => this.retention.purgeAuthTokens());
  }

  /** Drops old, cleanly processed webhook deliveries. */
  @Cron('45 3 * * *')
  purgeWebhookEvents() {
    return this.runner.run('webhooks.purge', () => this.retention.purgeWebhookEvents());
  }

  /** Sends emails that failed the first time (or whose sender died mid-way), with backoff. */
  @Cron(CronExpression.EVERY_MINUTE)
  processEmails() {
    return this.runner.run('email.process', () => this.emails.processDue());
  }

  /** Drops old sent and dead-lettered outbox rows. */
  @Cron('50 3 * * *')
  purgeEmailOutbox() {
    return this.runner.run('email.purge', () => this.retention.purgeEmailOutbox());
  }

  /** Drops the IP address from audit rows older than the retention window. */
  @Cron('55 3 * * *')
  scrubAuditIps() {
    return this.runner.run('audit.scrub-ips', () => this.retention.scrubAuditIps());
  }

  /** Drops stale login/track guess counters. */
  @Cron('35 3 * * *')
  purgeAuthThrottle() {
    return this.runner.run('auth.purge-throttle', () => this.retention.purgeAuthThrottle());
  }

  /** Deletes uploaded images nobody attached to anything within a week (file and record). */
  @Cron('20 4 * * *')
  purgeOrphanUploads() {
    return this.runner.run('uploads.purge-orphans', () => this.uploads.purgeOrphans());
  }

  /** Anonymises accounts whose 30-day deletion grace period is over (defers any with an order or refund still open). */
  @Cron('10 4 * * *')
  eraseDueAccounts() {
    return this.runner.run('account.erase-due', () => this.erasure.processDue());
  }

  /** Emails the owner once about support tickets whose 48 hour acknowledgement or resolution date is close or past. */
  @Cron(CronExpression.EVERY_HOUR)
  supportSla() {
    return this.runner.run('support.sla', () => this.support.slaSweep());
  }

  /** Closes resolved tickets the customer never answered, and deletes tickets 3 years after they closed. */
  @Cron('25 4 * * *')
  supportHousekeeping() {
    return this.runner.run('support.housekeeping', async () => ({ closed: await this.support.autoClose(), purged: await this.retention.purgeSupportTickets() }));
  }

  /** Drops the IP address and browser string from old refresh-token rows. */
  @Cron('58 3 * * *')
  scrubTokenMeta() {
    return this.runner.run('auth.scrub-token-meta', () => this.retention.scrubTokenMeta());
  }
}
