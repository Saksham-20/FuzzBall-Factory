import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { IdempotencyService } from '../common/idempotency/idempotency.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { RefundsService } from '../payments/refunds.service.js';
import { JobRunner } from './job-runner.service.js';

/** Every recurring job in one place. Each tick goes through `JobRunner` (one at a time, logged, never throws). */
@Injectable()
export class ScheduledJobs {
  constructor(
    private readonly runner: JobRunner,
    private readonly orders: OrdersService,
    private readonly idempotency: IdempotencyService,
    private readonly refunds: RefundsService,
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
}
