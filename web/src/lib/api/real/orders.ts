import { ApiError } from "@/lib/api/errors";
import { http, newIdempotencyKey, settlePayment, type CheckoutPayment } from "@/lib/api/http";
import type { CheckoutOptions, CheckoutQuote } from "@/lib/pricing";
import type { CartLine, Order } from "@/lib/types";
import type { PlaceOrderInput } from "@/lib/api/orders";

const cleanLines = (lines: CartLine[]) => lines.map((l) => ({ productId: l.productId, variantId: l.variantId, qty: l.qty, ...(l.personalization ? { personalization: l.personalization } : {}) }));

/** `opts` is merged flat into the body. Coupon problems come back in `couponError`, not as an HTTP error. */
export const quote = (lines: CartLine[], opts: CheckoutOptions) =>
  http<CheckoutQuote>("/checkout/quote", { method: "POST", body: { lines: cleanLines(lines), ...stripUndefined(opts) } });

const stripUndefined = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== "")) as T;

/** Payments created by placeOrder / retry, keyed by order number, so confirmPayment(number, ok) can settle them. */
const payments = new Map<string, CheckoutPayment>();

/**
 * One idempotency key per checkout attempt: a retry of the *same* body (double click, dropped connection) reuses it and the
 * API replays the stored order instead of creating a second one. The key is dropped once the API gave a definite answer.
 */
let attempt: { sig: string; key: string } | null = null;

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  const body = stripUndefined({
    lines: cleanLines(input.lines),
    contact: input.contact,
    address: stripUndefined(input.address),
    giftWrap: input.giftWrap,
    giftNote: input.giftNote,
    hidePrices: input.hidePrices,
    coupon: input.coupon,
    paymentMethod: input.paymentMethod,
    saveAddress: input.saveAddress,
  });
  const sig = JSON.stringify(body);
  if (!attempt || attempt.sig !== sig) attempt = { sig, key: newIdempotencyKey() };
  try {
    const res = await http<Order & { payment?: CheckoutPayment }>("/orders", { method: "POST", body, idempotencyKey: attempt.key });
    attempt = null;
    const { payment, ...order } = res;
    if (payment) payments.set(order.number, payment);
    return order;
  } catch (e) {
    // A definite 4xx means nothing was created: the next attempt is a new one. Network/5xx keeps the key so a retry is safe.
    if (e instanceof ApiError && e.status >= 400 && e.status < 500) attempt = null;
    throw e;
  }
}

/**
 * Settles the payment created for `number` and returns the refreshed order.
 * Dev/mock payment mode: POST /payments/mock/:id/confirm { ok }. Live mode: see `settlePayment` (Razorpay TODO seam).
 */
export async function confirmPayment(number: string, ok: boolean): Promise<Order> {
  let payment = payments.get(number);
  // Reloaded page, or a previous attempt failed: ask for a fresh attempt on the same unpaid order.
  payment ??= await http<CheckoutPayment>(`/orders/${encodeURIComponent(number)}/pay`, { method: "POST" });
  try {
    await settlePayment(payment, ok);
  } catch (e) {
    payments.delete(number); // a failed attempt can't be confirmed again: the retry opens a new one
    throw e;
  }
  payments.delete(number);
  return getOrder(number);
}

export const listMyOrders = () => http<Order[]>("/orders");
export const getOrder = (number: string) => http<Order>(`/orders/${encodeURIComponent(number)}`);
export const trackOrder = (number: string, contact: string) => http<Order>("/orders/track", { method: "POST", body: { number: number.trim(), contact: contact.trim() } });
export const cancelOrder = (number: string, reason?: string) => http<Order>(`/orders/${encodeURIComponent(number)}/cancel`, { method: "POST", body: reason ? { reason } : {} });
export const requestReturn = (number: string, reason: string) => http<Order>(`/orders/${encodeURIComponent(number)}/return`, { method: "POST", body: { reason } });
