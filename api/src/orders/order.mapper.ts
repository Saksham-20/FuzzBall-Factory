import type { Order, OrderEvent, OrderItem, Prisma } from '../generated/prisma/client.js';

/** Wire shapes: web/src/lib/types.ts `Order`, `OrderItem`, `TimelineEvent`. */
export interface OrderItemDto {
  productId: string;
  name: string;
  image: string;
  colour: string;
  size?: string;
  qty: number;
  unitPrice: number;
  fulfilment: 'READY' | 'MADE_TO_ORDER';
  personalization?: string;
}

export interface TimelineEventDto {
  status: string;
  at: string;
  note?: string;
  photo?: string;
}

export interface OrderDto {
  number: string;
  userId?: string;
  contact: { name: string; email: string; phone: string };
  address: { name: string; phone: string; line1: string; line2?: string; city: string; state: string; postalCode: string; country: string };
  items: OrderItemDto[];
  subtotal: number;
  shipping: number;
  codFee: number;
  giftWrap: number;
  discount: number;
  total: number;
  currency: 'INR';
  paymentMethod: 'RAZORPAY' | 'COD';
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'COD_DUE';
  status: Order['status'];
  giftNote?: string;
  estimatedDispatch: string;
  courier?: string;
  awb?: string;
  events: TimelineEventDto[];
  createdAt: string;
}

export type OrderRow = Order & { items: OrderItem[]; events: OrderEvent[] };

export const ORDER_INCLUDE = {
  items: { orderBy: { id: 'asc' } },
  events: { orderBy: [{ at: 'asc' }, { id: 'asc' }] },
} satisfies Prisma.OrderInclude;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export const toOrderItemDto = (i: OrderItem): OrderItemDto => ({
  productId: i.productId ?? '',
  name: i.name,
  image: i.image,
  colour: i.colour,
  ...(i.size ? { size: i.size } : {}),
  qty: i.qty,
  unitPrice: i.unitPrice,
  fulfilment: i.fulfilment,
  ...(i.personalization ? { personalization: i.personalization } : {}),
});

export function toOrderDto(o: OrderRow): OrderDto {
  const c = (o.contact ?? {}) as Record<string, unknown>;
  const a = (o.address ?? {}) as Record<string, unknown>;
  return {
    number: o.number,
    ...(o.userId ? { userId: o.userId } : {}),
    contact: { name: str(c.name), email: str(c.email), phone: str(c.phone) },
    address: {
      name: str(a.name),
      phone: str(a.phone),
      line1: str(a.line1),
      ...(str(a.line2) ? { line2: str(a.line2) } : {}),
      city: str(a.city),
      state: str(a.state),
      postalCode: str(a.postalCode),
      country: str(a.country),
    },
    items: o.items.map(toOrderItemDto),
    subtotal: o.subtotal,
    shipping: o.shipping,
    codFee: o.codFee,
    giftWrap: o.giftWrap,
    discount: o.discount,
    total: o.total,
    currency: 'INR',
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    ...(o.giftNote ? { giftNote: o.giftNote } : {}),
    estimatedDispatch: o.estimatedDispatch.toISOString(),
    ...(o.courier ? { courier: o.courier } : {}),
    ...(o.awb ? { awb: o.awb } : {}),
    events: o.events.map((e) => ({ status: e.status, at: e.at.toISOString(), ...(e.note ? { note: e.note } : {}), ...(e.photo ? { photo: e.photo } : {}) })),
    createdAt: o.createdAt.toISOString(),
  };
}
