import { Injectable } from '@nestjs/common';
import { badRequest } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuditListQuery } from './dto/audit.dto.js';

export interface AuditEntryDto {
  id: string;
  at: string;
  actor: { id: string; name: string; email: string } | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: unknown;
  ip: string | null;
}

export interface AuditPage {
  items: AuditEntryDto[];
  /** Pass as `before` for the next (older) page; absent on the last page. */
  nextCursor?: string;
}

const DEFAULT_LIMIT = 50;

/** Read-only view of the admin audit trail, newest first, filterable, cursor-paged. */
@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: AuditListQuery): Promise<AuditPage> {
    const limit = q.limit ?? DEFAULT_LIMIT;
    if (q.before && !(await this.prisma.auditLog.findUnique({ where: { id: q.before }, select: { id: true } }))) throw badRequest('That page cursor is no longer valid.');
    const rows = await this.prisma.auditLog.findMany({
      where: { ...(q.action ? { action: { startsWith: q.action } } : {}), ...(q.entity ? { entity: q.entity } : {}), ...(q.entityId ? { entityId: q.entityId } : {}), ...(q.actorId ? { actorId: q.actorId } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(q.before ? { cursor: { id: q.before }, skip: 1 } : {}),
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((r) => ({ id: r.id, at: r.createdAt.toISOString(), actor: r.actor, action: r.action, entity: r.entity, entityId: r.entityId, meta: r.meta, ip: r.ip })),
      ...(rows.length > limit ? { nextCursor: page[page.length - 1]!.id } : {}),
    };
  }
}
