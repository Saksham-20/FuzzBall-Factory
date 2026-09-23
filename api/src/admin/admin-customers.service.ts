import { Injectable } from '@nestjs/common';
import { notFound } from '../common/errors.js';
import { customInclude, toCustomRequestDto, type CustomRequestDto } from '../custom/custom.mapper.js';
import { toOrderDto, type OrderDto } from '../orders/order.mapper.js';
import { ORDER_INCLUDE } from './admin-orders.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserDto, type UserDto } from '../users/user.mapper.js';

/** Wire shape: web admin `CustomerRow`. `spent` counts paid orders only. */
export interface CustomerRow extends UserDto {
  orders: number;
  workOrders: number;
  spent: number;
}

export interface CustomerDetail {
  user: UserDto;
  orders: OrderDto[];
  custom: CustomRequestDto[];
}

@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q?: string): Promise<CustomerRow[]> {
    const term = q?.trim();
    const users = await this.prisma.user.findMany({
      where: { role: 'customer', ...(term ? { OR: [{ name: { contains: term, mode: 'insensitive' } }, { email: { contains: term, mode: 'insensitive' } }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
    const ids = users.map((u) => u.id);
    const [orderCounts, paid, workOrders] = await Promise.all([
      this.prisma.order.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: { _all: true } }),
      this.prisma.order.groupBy({ by: ['userId'], where: { userId: { in: ids }, paymentStatus: 'PAID' }, _sum: { total: true } }),
      this.prisma.customRequest.groupBy({ by: ['userId'], where: { userId: { in: ids } }, _count: { _all: true } }),
    ]);
    const count = new Map(orderCounts.map((r) => [r.userId, r._count._all]));
    const spent = new Map(paid.map((r) => [r.userId, r._sum.total ?? 0]));
    const wo = new Map(workOrders.map((r) => [r.userId, r._count._all]));
    return users.map((u) => ({ ...toUserDto(u), orders: count.get(u.id) ?? 0, workOrders: wo.get(u.id) ?? 0, spent: spent.get(u.id) ?? 0 }));
  }

  async get(id: string): Promise<CustomerDetail> {
    const user = await this.prisma.user.findFirst({ where: { id, role: 'customer' } });
    if (!user) throw notFound('Customer not found.');
    const [orders, custom] = await Promise.all([
      this.prisma.order.findMany({ where: { userId: id }, include: ORDER_INCLUDE, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
      this.prisma.customRequest.findMany({ where: { userId: id }, include: customInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] }),
    ]);
    return { user: toUserDto(user), orders: orders.map(toOrderDto), custom: custom.map(toCustomRequestDto) };
  }
}
