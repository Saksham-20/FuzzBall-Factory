import { Injectable, NotFoundException } from '@nestjs/common';
import { toAddressDto } from '../account/address.mapper.js';
import { customInclude, toCustomRequestDto } from '../custom/custom.mapper.js';
import { ORDER_INCLUDE, toOrderDto } from '../orders/order.mapper.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toUserDto } from '../users/user.mapper.js';

/**
 * DPDP Act right of access: everything the shop holds about one customer, as a single JSON document. Their own data
 * only, never other people's (a work order's maker replies are part of their conversation and are included).
 */
@Injectable()
export class AccountExportService {
  constructor(private readonly prisma: PrismaService) {}

  async export(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.erasedAt) throw new NotFoundException();
    const [addresses, orders, requests, reviews, wishlist, uploads, payments] = await Promise.all([
      this.prisma.address.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.order.findMany({ where: { userId }, include: ORDER_INCLUDE, orderBy: { createdAt: 'asc' } }),
      this.prisma.customRequest.findMany({ where: { userId }, include: customInclude, orderBy: { createdAt: 'asc' } }),
      this.prisma.review.findMany({ where: { userId }, include: { product: { select: { slug: true, name: true } } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.wishlistItem.findMany({ where: { userId }, include: { product: { select: { slug: true, name: true } } } }),
      this.prisma.upload.findMany({ where: { userId }, select: { url: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.payment.findMany({
        where: { OR: [{ order: { userId } }, { request: { userId } }] },
        select: { purpose: true, amount: true, currency: true, status: true, method: true, refundedAmount: true, paidAt: true, createdAt: true, order: { select: { number: true } }, request: { select: { number: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      about: 'Everything FuzzBall Factory holds about this account. Passwords are stored only as one-way hashes and are not included.',
      profile: { ...toUserDto(user), phoneVerified: user.phoneVerified },
      addresses: addresses.map(toAddressDto),
      orders: orders.map(toOrderDto),
      workOrders: requests.map(toCustomRequestDto),
      payments: payments.map((p) => ({ ...p, order: p.order?.number ?? null, request: p.request?.number ?? null })),
      reviews: reviews.map((r) => ({ product: r.product.name, productSlug: r.product.slug, rating: r.rating, body: r.body, status: r.status, createdAt: r.createdAt, reply: r.reply })),
      wishlist: wishlist.map((w) => ({ product: w.product.name, productSlug: w.product.slug })),
      uploads,
    };
  }
}
