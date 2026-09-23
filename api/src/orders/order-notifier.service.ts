import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import type { OrderPayload } from '../notifications/events.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { OrderStatus } from '../generated/prisma/enums.js';
import type { OrderRow } from './order.mapper.js';

const EVENT_FOR_STATUS: Partial<Record<OrderStatus, 'order.confirmed' | 'order.shipped' | 'order.delivered' | 'order.cancelled'>> = {
  CONFIRMED: 'order.confirmed',
  SHIPPED: 'order.shipped',
  DELIVERED: 'order.delivered',
  CANCELLED: 'order.cancelled',
};

const dispatchFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

/** Builds order emails and hands them to NotificationsService. Always call AFTER the transaction commits. */
@Injectable()
export class OrderNotifier {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Signed-in customers see the order page; guests use the track page (their cookie may be gone by then). */
  orderUrl(order: Pick<OrderRow, 'number' | 'userId'>): string {
    const origin = this.config.get('WEB_ORIGIN', { infer: true }).split(',')[0].trim().replace(/\/$/, '');
    return order.userId ? `${origin}/order/${order.number}` : `${origin}/track?order=${encodeURIComponent(order.number)}`;
  }

  payload(order: OrderRow, extra: { note?: string } = {}): OrderPayload {
    const contact = (order.contact ?? {}) as { name?: string };
    return {
      to: order.contactEmail,
      name: contact.name ?? 'there',
      orderNumber: order.number,
      url: this.orderUrl(order),
      total: order.total,
      paymentMethod: order.paymentMethod,
      items: order.items.map((i) => ({ name: i.name, qty: i.qty })),
      estimatedDispatch: dispatchFormat.format(order.estimatedDispatch),
      ...(order.courier ? { courier: order.courier } : {}),
      ...(order.awb ? { awb: order.awb } : {}),
      ...(extra.note ? { note: extra.note } : {}),
    };
  }

  /** COD orders are "placed" immediately; online orders are announced when payment lands (see `transitioned`). */
  placed(order: OrderRow): Promise<void> {
    return this.notifications.send('order.placed', this.payload(order));
  }

  transitioned(order: OrderRow, to: OrderStatus, note?: string): Promise<void> {
    const event = EVENT_FOR_STATUS[to];
    if (!event) return Promise.resolve();
    return this.notifications.send(event, this.payload(order, { note }));
  }
}
