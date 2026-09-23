import { Global, Module } from '@nestjs/common';
import { EmailProvider } from './email.provider.js';
import { NotificationsService } from './notifications.service.js';

@Global()
@Module({
  providers: [EmailProvider, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
