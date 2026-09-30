import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OrdersModule } from '../orders/orders.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { JobRunner } from './job-runner.service.js';
import { ScheduledJobs } from './scheduled-jobs.service.js';

/** Recurring background work (Postgres-backed, no queue service). Add a job as a `@Cron` method on `ScheduledJobs`. */
@Module({
  imports: [ScheduleModule.forRoot(), OrdersModule, PaymentsModule],
  providers: [JobRunner, ScheduledJobs],
  exports: [JobRunner],
})
export class JobsModule {}
