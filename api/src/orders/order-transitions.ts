import type { OrderStatus } from '../generated/prisma/enums.js';

/**
 * The admin-facing transition table: identical to `ORDER_NEXT` in web/src/lib/api/admin.ts (the admin UI
 * offers exactly these next steps). `OrderStateService.transition` enforces it for every actor.
 *
 * Two edges are deliberately NOT in this table because they are not something anybody clicks:
 *  - PENDING_PAYMENT -> CONFIRMED, which only a captured payment causes (`OrderStateService.applyPayment`)
 *  - PLACED (COD) -> CANCELLED is here, but customers may only cancel from CUSTOMER_CANCELLABLE
 */
export const ORDER_NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PRODUCTION', 'PACKED', 'CANCELLED'],
  IN_PRODUCTION: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: ['RETURN_REQUESTED'],
  CANCELLED: [],
  RETURN_REQUESTED: ['REFUNDED', 'DELIVERED'],
  REFUNDED: [],
};

export const allowedNextStatuses = (s: OrderStatus): OrderStatus[] => ORDER_NEXT[s];
export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => ORDER_NEXT[from].includes(to);

/** Statuses a customer may cancel from (same as the web mock's `cancelOrder`). */
export const CUSTOMER_CANCELLABLE: OrderStatus[] = ['PENDING_PAYMENT', 'PLACED', 'CONFIRMED'];

/** Days after delivery within which a return can be requested. */
export const RETURN_WINDOW_DAYS = 7;

/** A Razorpay order that is still unpaid after this long is cancelled and its stock released. */
export const PAYMENT_WINDOW_MINUTES = 30;
