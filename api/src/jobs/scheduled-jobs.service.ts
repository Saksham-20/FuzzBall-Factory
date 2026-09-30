import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { QuoteExpiryService } from '../custom/quote-expiry.service.js';
import { EmailOutboxService } from '../notifications/email-outbox.service.js';
import { IdempotencyService } from '../common/idempotency/idempotency.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { RefundsService } from '../payments/refunds.service.js';
import { JobRunner } from './job-runner.service.js';
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
  ) {}

  /** Releases stock held by online orders nobody paid within the payment window. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  sweepUnpaidOrders() {
    return this.runner.run('orders.sweep-unpaid', () => this.orders.expireUnpaidOrders());
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
}
