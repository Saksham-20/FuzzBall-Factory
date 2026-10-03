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
  /** True when the parcel ships outside India: the emails add the customs and duties reminder. */
  international?: boolean;
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

export interface TicketPayload extends Recipient {
  /** SUP-0001, GRV-0001 ... */
  ticketNumber: string;
  subject: string;
  /** Absolute link to the ticket thread. */
  url: string;
  /** GRIEVANCE tickets carry the one-month promise and the escalation route. */
  grievance?: boolean;
  /** The text of the message being announced (the complaint as recorded, a reply, or a resolution note). */
  message?: string;
  /** Raw due date for the resolution promise, formatted for the email. */
  resolveBy?: string;
}

export interface NotificationEventMap {
  // Support tickets (docs/LEGAL_REVIEW.md: acknowledge within 48 hours, with a copy of the complaint as recorded)
  /** To the customer, at once: the reference number and a copy of what was recorded. */
  'ticket.received': TicketPayload;
  /** To the customer: the maker answered. */
  'ticket.reply': TicketPayload;
  /** To the customer: the ticket is resolved. */
  'ticket.resolved': TicketPayload;
  /** To the shop inbox (`to`): a new ticket, or the customer wrote again. `name` is the sender's. */
  'ticket.new_admin': Recipient & { ticketNumber: string; subject: string; url: string; fromEmail?: string; message: string; kind: string; isReply: boolean };
  /** To the shop inbox: tickets approaching a deadline. */
  'ticket.sla_reminder': Recipient & { items: { ticketNumber: string; subject: string; url: string; what: string }[] };

  // Accounts
  'auth.welcome': Recipient;
  'auth.password_reset': Recipient & { resetUrl: string; expiresInMinutes: number };
  'auth.verify_email': Recipient & { verifyUrl: string; expiresInMinutes: number };
  /** Sent to the NEW address: the switch only happens when its owner clicks. */
  'auth.confirm_email_change': Recipient & { confirmUrl: string; expiresInMinutes: number };
  /** Sent to the OLD address so a hijacked session cannot quietly move the account. */
  'auth.email_change_notice': Recipient & { newEmail: string };
  /** Last message to the old address once an account has been erased. */
  'auth.account_erased': Recipient;

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
  /** Where a reply should go, when that is not the sender address. */
  replyTo?: string;
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
