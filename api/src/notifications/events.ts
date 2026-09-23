/**
 * Typed notification events. Add an event in three steps:
 *   1. add its payload type to `NotificationEventMap` below
 *   2. add a template to `templates/registry.ts` (the compiler forces this: the registry is a total mapping)
 *   3. call `notifications.send('your.event', payload)` from the state service that performs the transition
 *
 * Every payload carries `to` (recipient email) and `name`. Keep payloads plain data (no Prisma rows).
 */
export interface Recipient {
  to: string;
  name: string;
}

export interface OrderPayload extends Recipient {
  orderNumber: string;
  /** Absolute link to the order/tracking page. */
  url: string;
  /** Total in rupees, when relevant. */
  total?: number;
  /** Free-text note from the maker (e.g. the timeline note). */
  note?: string;
  courier?: string;
  awb?: string;
  estimatedDispatch?: string;
  paymentMethod?: 'RAZORPAY' | 'COD';
  /** Short receipt lines (name and quantity), when relevant. */
  items?: { name: string; qty: number }[];
}

export interface WorkOrderPayload extends Recipient {
  workOrderNumber: string;
  title: string;
  /** Absolute link to the work-order thread. */
  url: string;
  /** Amount in rupees (quote price, deposit or balance due), when relevant. */
  amount?: number;
  note?: string;
  courier?: string;
  awb?: string;
}

export interface NotificationEventMap {
  // Accounts
  'auth.welcome': Recipient;
  'auth.password_reset': Recipient & { resetUrl: string; expiresInMinutes: number };

  // Orders
  'order.placed': OrderPayload;
  'order.confirmed': OrderPayload;
  'order.shipped': OrderPayload;
  'order.delivered': OrderPayload;
  'order.cancelled': OrderPayload;

  // Work orders (custom requests)
  'workorder.received': WorkOrderPayload;
  'workorder.quoted': WorkOrderPayload;
  'workorder.countered': WorkOrderPayload;
  'workorder.accepted': WorkOrderPayload;
  'workorder.deposit_paid': WorkOrderPayload;
  'workorder.progress': WorkOrderPayload;
  'workorder.awaiting_approval': WorkOrderPayload;
  'workorder.balance_due': WorkOrderPayload;
  'workorder.shipped': WorkOrderPayload;
  'workorder.declined': WorkOrderPayload;
}

export type NotificationEvent = keyof NotificationEventMap;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** A template turns a payload into an email. `ctx.brand` carries shop-level details. */
export type Template<E extends NotificationEvent> = (payload: NotificationEventMap[E], ctx: TemplateContext) => RenderedEmail;

export interface TemplateContext {
  brandName: string;
  supportEmail?: string;
  whatsappNumber?: string;
}
