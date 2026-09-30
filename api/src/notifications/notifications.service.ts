import { Injectable, Logger } from '@nestjs/common';
import type { NotificationEvent, NotificationEventMap } from './events.js';
import { EmailOutboxService } from './email-outbox.service.js';

/**
 * Single entry point for customer/admin messages. State services call
 * `notifications.send('order.shipped', payload)` after a transition commits.
 *
 * The message is written to the email outbox first and then sent straight away; a failure leaves it queued for the
 * scheduler to retry (see `EmailOutboxService`). `send` never throws: a mail outage must not fail (or roll back) an
 * order. Email only for now; a WhatsApp channel can be added behind this same method.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly outbox: EmailOutboxService) {}

  async send<E extends NotificationEvent>(event: E, payload: NotificationEventMap[E]): Promise<void> {
    try {
      const id = await this.outbox.enqueue(event, payload);
      await this.outbox.deliver(id);
    } catch (err) {
      // Could not even reach the outbox (database down): nothing more to do than say so.
      this.logger.error(`Failed to queue "${event}" to ${payload.to}: ${(err as Error).message}`);
    }
  }
}
