import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { NotificationEvent, NotificationEventMap, TemplateContext } from './events.js';
import { EmailProvider } from './email.provider.js';
import { renderTemplate } from './templates/registry.js';

/**
 * Single entry point for customer/admin messages. State services call
 * `notifications.send('order.shipped', payload)` after a transition commits.
 *
 * `send` never throws: a mail outage must not fail (or roll back) an order. Failures are logged.
 * Email only for now; a WhatsApp channel can be added behind this same method.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly email: EmailProvider,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async send<E extends NotificationEvent>(event: E, payload: NotificationEventMap[E]): Promise<void> {
    try {
      const rendered = renderTemplate(event, payload, this.context());
      await this.email.send({ to: payload.to, ...rendered });
    } catch (err) {
      this.logger.error(`Failed to send "${event}" to ${payload.to}: ${(err as Error).message}`);
    }
  }

  private context(): TemplateContext {
    const from = this.config.get('MAIL_FROM', { infer: true });
    const supportEmail = /<([^>]+)>/.exec(from)?.[1];
    return { brandName: 'FuzzBall Factory', supportEmail, whatsappNumber: this.config.get('WHATSAPP_NUMBER', { infer: true }) };
  }
}
