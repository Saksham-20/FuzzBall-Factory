import { Injectable } from '@nestjs/common';
import { EmailOutboxService, type OutboxRow } from '../notifications/email-outbox.service.js';
import type { AdminCtx } from './admin-custom.service.js';
import type { EmailListQuery } from './dto/email.dto.js';
import { AuditService } from './audit.service.js';

/** The admin's view of outgoing email: what is queued, what went out, and what gave up (with a resend). */
@Injectable()
export class AdminEmailService {
  constructor(
    private readonly outbox: EmailOutboxService,
    private readonly audit: AuditService,
  ) {}

  list(q: EmailListQuery): Promise<OutboxRow[]> {
    return this.outbox.list(q.status, q.limit);
  }

  async retry(ctx: AdminCtx, id: string): Promise<OutboxRow> {
    const row = await this.outbox.retry(id);
    await this.audit.log({ actorId: ctx.actorId, ip: ctx.ip, action: 'email.retry', entity: 'EmailOutbox', entityId: id, meta: { event: row.event, status: row.status } });
    return row;
  }
}
