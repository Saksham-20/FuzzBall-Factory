import { Injectable, Logger } from '@nestjs/common';
import { SupportService } from '../support/support.service.js';
import type { ContactDto } from './contact.dto.js';

/**
 * "Write to the maker" form, kept for older clients: it now opens a support ticket (kind SUPPORT, topic "general")
 * instead of only sending an email, so the message has a reference number, a thread and a place in the admin inbox.
 * The newer form posts to `POST /support/tickets` directly.
 */
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(private readonly support: SupportService) {}

  async submit(dto: ContactDto): Promise<void> {
    if (dto.website?.trim()) {
      this.logger.warn('Contact form honeypot filled; message dropped');
      return;
    }
    await this.support.create({ kind: 'SUPPORT', category: 'general', name: dto.name, email: dto.email, message: dto.message });
  }
}
