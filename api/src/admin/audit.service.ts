import { createParamDecorator, Injectable, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Db = PrismaClient | Prisma.TransactionClient;

/** The caller's IP for the audit trail (honours `trust proxy`). */
export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => ctx.switchToHttp().getRequest<Request>().ip);

export interface AuditEntry {
  actorId: string;
  /** Verb.noun, e.g. `product.update`, `custom.quote`, `settings.update`. */
  action: string;
  entity: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
  ip?: string;
}

/**
 * Every admin write leaves an `AuditLog` row. Pass the transaction client so the audit row commits or rolls back
 * together with the change it describes.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry, db: Db = this.prisma): Promise<void> {
    await db.auditLog.create({
      data: { actorId: entry.actorId, action: entry.action, entity: entry.entity, entityId: entry.entityId, meta: entry.meta, ip: entry.ip },
    });
  }
}
