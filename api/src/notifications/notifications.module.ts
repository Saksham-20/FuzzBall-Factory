import { Global, Module } from '@nestjs/common';
import { EmailOutboxService } from './email-outbox.service.js';
import { EmailProvider } from './email.provider.js';
import { NotificationsService } from './notifications.service.js';

@Global()
@Module({
  providers: [EmailProvider, EmailOutboxService, NotificationsService],
  exports: [NotificationsService, EmailOutboxService],
})
export class NotificationsModule {}
