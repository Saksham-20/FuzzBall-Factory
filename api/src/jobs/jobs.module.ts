import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountModule } from '../account/account.module.js';
import { CustomModule } from '../custom/custom.module.js';
import { OrdersModule } from '../orders/orders.module.js';
import { PaymentsModule } from '../payments/payments.module.js';
import { UploadsModule } from '../uploads/uploads.module.js';
import { JobRunner } from './job-runner.service.js';
import { RetentionService } from './retention.service.js';
import { ScheduledJobs } from './scheduled-jobs.service.js';

/** Recurring background work (Postgres-backed, no queue service). Add a job as a `@Cron` method on `ScheduledJobs`. */
@Module({
  imports: [ScheduleModule.forRoot(), OrdersModule, PaymentsModule, CustomModule, UploadsModule, AccountModule],
  providers: [JobRunner, ScheduledJobs, RetentionService],
  exports: [JobRunner],
})
export class JobsModule {}
