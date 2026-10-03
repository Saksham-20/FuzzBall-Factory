import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { RETAIN_AFTER_CLOSE_DAYS } from '../support/support.rules.js';

const DAY_MS = 86_400_000;
/** Refresh and reset tokens are useless once expired; the small grace keeps reuse-detection evidence for a while. */
const TOKEN_GRACE_DAYS = 7;
/** Webhook deliveries are kept for support and reconciliation, then dropped. */
const WEBHOOK_KEEP_DAYS = 90;

/** Sent emails are only a delivery log; dead letters stay longer so they can be investigated. */
const EMAIL_SENT_KEEP_DAYS = 30;
const EMAIL_FAILED_KEEP_DAYS = 90;

/** After this long an audit row keeps what was done and by whom, but not the IP address it came from. */
const AUDIT_IP_KEEP_DAYS = 90;

/** Refresh-token rows keep the IP address and browser string for this long (to spot a stolen session), then only the fact of a login. */
const TOKEN_META_KEEP_DAYS = 30;

/** Deletes rows that only exist to be looked at briefly. Each method returns how many rows it removed. */
@Injectable()
export class RetentionService {
  constructor(private readonly prisma: PrismaService) {}

  async purgeAuthTokens(now: Date = new Date()): Promise<{ refresh: number; reset: number }> {
    const cutoff = new Date(now.getTime() - TOKEN_GRACE_DAYS * DAY_MS);
    const [refresh, reset] = await Promise.all([
      this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
      this.prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    ]);
    const verify = await this.prisma.emailToken.deleteMany({ where: { expiresAt: { lt: cutoff } } });
    return { refresh: refresh.count, reset: reset.count + verify.count };
  }

  /** Only processed deliveries: an unprocessed or errored one is evidence somebody still needs to see. */
  async purgeWebhookEvents(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - WEBHOOK_KEEP_DAYS * DAY_MS);
    const { count } = await this.prisma.webhookEvent.deleteMany({ where: { receivedAt: { lt: cutoff }, processedAt: { not: null }, error: null } });
    return count;
  }

  async purgeEmailOutbox(now: Date = new Date()): Promise<number> {
    const [sent, failed] = await Promise.all([
      this.prisma.emailOutbox.deleteMany({ where: { status: 'SENT', createdAt: { lt: new Date(now.getTime() - EMAIL_SENT_KEEP_DAYS * DAY_MS) } } }),
      this.prisma.emailOutbox.deleteMany({ where: { status: 'FAILED', createdAt: { lt: new Date(now.getTime() - EMAIL_FAILED_KEEP_DAYS * DAY_MS) } } }),
    ]);
    return sent.count + failed.count;
  }

  /** Forgets the IP on old audit rows (personal data with a short useful life). Returns how many rows changed. */
  async scrubAuditIps(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.auditLog.updateMany({ where: { ip: { not: null }, createdAt: { lt: new Date(now.getTime() - AUDIT_IP_KEEP_DAYS * DAY_MS) } }, data: { ip: null } });
    return count;
  }

  /** Support tickets (and, by cascade, their messages) go RETAIN_AFTER_CLOSE_DAYS after they were closed. Open ones stay. */
  async purgeSupportTickets(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.supportTicket.deleteMany({ where: { status: 'CLOSED', closedAt: { lt: new Date(now.getTime() - RETAIN_AFTER_CLOSE_DAYS * DAY_MS) } } });
    return count;
  }

  /** Guess counters older than a day no longer matter (their windows and locks are minutes long). */
  async purgeAuthThrottle(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.authThrottle.deleteMany({ where: { updatedAt: { lt: new Date(now.getTime() - DAY_MS) } } });
    return count;
  }

  /** Forgets the IP and user agent on refresh tokens older than the window. Returns how many rows changed. */
  async scrubTokenMeta(now: Date = new Date()): Promise<number> {
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { createdAt: { lt: new Date(now.getTime() - TOKEN_META_KEEP_DAYS * DAY_MS) }, OR: [{ ip: { not: null } }, { userAgent: { not: null } }] },
      data: { ip: null, userAgent: null },
    });
    return count;
  }
}
