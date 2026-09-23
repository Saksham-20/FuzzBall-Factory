import { Injectable } from '@nestjs/common';
import { notFound } from '../common/errors.js';
import type { Prisma } from '../generated/prisma/client.js';
import { OrderStateService } from '../orders/order-state.service.js';
import { toOrderDto, type OrderDto, type OrderRow } from '../orders/order.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminCtx } from './admin-custom.service.js';
import { AuditService } from './audit.service.js';
import type { OrderNotesDto, OrderStatusDto } from './dto/order.dto.js';
import type { OrderListQuery } from './dto/query.dto.js';

/** Same relations as the order mapper expects (declared here so the include is a mutable literal). */
export const ORDER_INCLUDE = {
  items: { orderBy: { id: 'asc' } },
  events: { orderBy: [{ at: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.OrderInclude;

/** Web `Order` plus the admin-only fields. */
export type AdminOrderDto = OrderDto & { notes?: string; hidePrices: boolean };

export const toAdminOrderDto = (o: OrderRow): AdminOrderDto => ({ ...toOrderDto(o), ...(o.notes ? { notes: o.notes } : {}), hidePrices: o.hidePrices });

/** What the printable packing slip needs. Prices are left out when the customer asked to hide them (gifts). */
export interface PackingSlipDto {
  number: string;
  createdAt: string;
  contact: { name: string; phone: string };
  address: OrderDto['address'];
  items: { name: string; colour: string; size?: string; qty: number; personalization?: string; unitPrice?: number }[];
  giftNote?: string;
  giftWrap: boolean;
  hidePrices: boolean;
  notes?: string;
  total?: number;
}

/**
 * Orders for the admin. Reads are Prisma queries; every status change is delegated to `OrderStateService`
 * (the only place an order's status changes), then audited.
 */
@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderState: OrderStateService,
    private readonly audit: AuditService,
  ) {}

  async list(query: OrderListQuery): Promise<AdminOrderDto[]> {
    const and: Prisma.OrderWhereInput[] = [];
    const s = query.status;
    if (s === 'TO_CONFIRM') and.push({ paymentMethod: 'COD', status: 'PLACED' });
    else if (s === 'TO_MAKE') and.push({ status: { in: ['CONFIRMED', 'IN_PRODUCTION'] }, items: { some: { fulfilment: 'MADE_TO_ORDER' } } });
    else if (s === 'TO_PACK') and.push({ status: { in: ['CONFIRMED', 'IN_PRODUCTION'] } });
    else if (s) and.push({ status: s });
    if (query.q) {
      and.push({
        OR: [
          { number: { contains: query.q, mode: 'insensitive' } },
          { contactPhone: { contains: query.q } },
          { contactEmail: { contains: query.q, mode: 'insensitive' } },
          { contact: { path: ['name'], string_contains: query.q, mode: 'insensitive' } },
        ],
      });
    }
    const rows = await this.prisma.order.findMany({ where: { AND: and }, include: ORDER_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 500 });
    return rows.map(toAdminOrderDto);
  }

  async get(number: string): Promise<AdminOrderDto> {
    return toAdminOrderDto(await this.load(number));
  }

  async updateStatus(ctx: AdminCtx, number: string, dto: OrderStatusDto): Promise<AdminOrderDto> {
    const before = await this.prisma.order.findUnique({ where: { number }, select: { status: true } });
    if (!before) throw notFound('Order not found.');
    await this.orderState.transition(number, dto.status, { userId: ctx.actorId, role: 'admin' }, { note: dto.note, courier: dto.courier, awb: dto.awb });
    await this.audit.log({ actorId: ctx.actorId, action: 'order.status', entity: 'Order', entityId: number, meta: { from: before.status, to: dto.status, courier: dto.courier ?? null, awb: dto.awb ?? null }, ip: ctx.ip });
    return this.get(number);
  }

  async updateNotes(ctx: AdminCtx, number: string, dto: OrderNotesDto): Promise<AdminOrderDto> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.order.updateMany({ where: { number }, data: { notes: dto.notes || null } });
      if (count !== 1) throw notFound('Order not found.');
      await this.audit.log({ actorId: ctx.actorId, action: 'order.notes', entity: 'Order', entityId: number, ip: ctx.ip }, tx);
    });
    return this.get(number);
  }

  async packingSlip(number: string): Promise<PackingSlipDto> {
    const order = toAdminOrderDto(await this.load(number));
    const hide = order.hidePrices;
    return {
      number: order.number,
      createdAt: order.createdAt,
      contact: { name: order.contact.name, phone: order.contact.phone },
      address: order.address,
      items: order.items.map((i) => ({
        name: i.name,
        colour: i.colour,
        ...(i.size ? { size: i.size } : {}),
        qty: i.qty,
        ...(i.personalization ? { personalization: i.personalization } : {}),
        ...(hide ? {} : { unitPrice: i.unitPrice }),
      })),
      ...(order.giftNote ? { giftNote: order.giftNote } : {}),
      giftWrap: order.giftWrap > 0,
      hidePrices: hide,
      ...(order.notes ? { notes: order.notes } : {}),
      ...(hide ? {} : { total: order.total }),
    };
  }

  private async load(number: string): Promise<OrderRow> {
    const row = await this.prisma.order.findUnique({ where: { number }, include: ORDER_INCLUDE });
    if (!row) throw notFound('Order not found.');
    return row;
  }
}
