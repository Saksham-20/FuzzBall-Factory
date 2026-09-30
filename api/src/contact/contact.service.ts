import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../common/errors.js';
import type { Env } from '../config/env.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { ContactDto } from './contact.dto.js';

/**
 * "Write to the maker" form. The message goes to the shop inbox through the email outbox (so a mail outage delays
 * it instead of losing it) with the visitor's address as Reply-To. Nothing is stored beyond the outbox row, which
 * is emptied once the mail is sent. The message text is never logged.
 */
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Where messages go: CONTACT_INBOX_EMAIL, else the admin's address. Unset = the form is off. */
  private inbox(): string | undefined {
    return this.config.get('CONTACT_INBOX_EMAIL', { infer: true }) ?? this.config.get('ADMIN_EMAIL', { infer: true });
  }

  async submit(dto: ContactDto): Promise<void> {
    const to = this.inbox();
    if (!to) {
      throw new AppException(HttpStatus.SERVICE_UNAVAILABLE, 'CONTACT_UNAVAILABLE', "The contact form isn't switched on yet. Please message us on WhatsApp.");
    }
    if (dto.website?.trim()) {
      this.logger.warn('Contact form honeypot filled; message dropped');
      return;
    }
    await this.notifications.send('contact.message', { to, name: dto.name, fromEmail: dto.email, message: dto.message });
  }
}
