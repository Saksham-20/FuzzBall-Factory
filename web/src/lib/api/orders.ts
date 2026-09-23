import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/orders";
import { ApiError, db, wait } from "@/lib/mock/db";
import { quoteCheckout, type CheckoutOptions, type CheckoutQuote } from "@/lib/pricing";
import type { Address, CartLine, Order, OrderItem, PaymentMethod } from "@/lib/types";

const digits = (s: string) => s.replace(/\D/g, "");

export async function quote(lines: CartLine[], opts: CheckoutOptions): Promise<CheckoutQuote> {
  if (!SITE.useMock) return real.quote(lines, opts);
  await wait(120);
  const d = db.get();
  return quoteCheckout(lines, opts, d.settings, d.products, d.coupons);
}

export interface PlaceOrderInput {
  lines: CartLine[];
  contact: { name: string; email: string; phone: string };
  address: Omit<Address, "id" | "label">;
  giftWrap?: boolean;
  giftNote?: string;
  hidePrices?: boolean;
  coupon?: string;
  paymentMethod: PaymentMethod;
  saveAddress?: boolean;
}

/** Creates the order. RAZORPAY orders start PENDING_PAYMENT until `confirmPayment`; COD starts PLACED. */
export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  if (!SITE.useMock) return real.placeOrder(input);
  await wait(500);
  const d = db.get();
  if (input.lines.length === 0) throw new ApiError(400, "Your basket is empty.");
  const q = quoteCheckout(input.lines, { country: input.address.country, giftWrap: input.giftWrap, coupon: input.coupon, paymentMethod: input.paymentMethod }, d.settings, d.products, d.coupons);
  if (input.paymentMethod === "COD" && !q.codEligible) throw new ApiError(400, q.codReason ?? "Cash on delivery isn't available for this order.");

  const items: OrderItem[] = [];
  for (const l of input.lines) {
    const p = d.products.find((x) => x.id === l.productId);
    const v = p?.variants.find((x) => x.id === l.variantId);
    if (!p || !v) throw new ApiError(404, "One of the pieces in your basket is no longer available.");
    if (v.stock < l.qty) throw new ApiError(409, `${p.name} just sold out or has fewer left than you asked for.`);
    items.push({ productId: p.id, name: p.name, image: p.images[0].src, colour: v.colour, size: v.size, qty: l.qty, unitPrice: p.price + v.priceDelta, fulfilment: p.fulfilment, personalization: l.personalization });
  }

  const number = `FB-${d.seq.order + 1}`;
  const now = new Date().toISOString();
  const paid = input.paymentMethod === "RAZORPAY";
  const order: Order = {
    number,
    userId: d.session?.userId,
    contact: input.contact,
    address: input.address,
    items,
    subtotal: q.subtotal, shipping: q.shipping, codFee: q.codFee, giftWrap: q.giftWrap, discount: q.discount, total: q.total,
    currency: "INR",
    paymentMethod: input.paymentMethod,
    paymentStatus: paid ? "PENDING" : "COD_DUE",
    status: paid ? "PENDING_PAYMENT" : "PLACED",
    giftNote: input.giftNote,
    estimatedDispatch: q.estimatedDispatch,
    events: [{ status: paid ? "PENDING_PAYMENT" : "PLACED", at: now, note: paid ? undefined : "Order placed. We'll confirm on WhatsApp before dispatch." }],
    createdAt: now,
  };

  db.update((x) => {
    const products = x.products.map((p) => {
      const touched = input.lines.filter((l) => l.productId === p.id);
      if (!touched.length) return p;
      return { ...p, variants: p.variants.map((v) => { const l = touched.find((t) => t.variantId === v.id); return l ? { ...v, stock: Math.max(0, v.stock - l.qty) } : v; }) };
    });
    const coupons = q.couponApplied ? x.coupons.map((c) => (c.code === q.couponApplied ? { ...c, uses: c.uses + 1 } : c)) : x.coupons;
    let addresses = x.addresses;
    let owner = x.addressOwner;
    if (input.saveAddress && x.session) {
      const a: Address = { ...input.address, id: `a${Date.now()}`, label: "Saved at checkout" };
      addresses = [...addresses, a];
      owner = { ...owner, [a.id]: x.session.userId };
    }
    return { ...x, products, coupons, addresses, addressOwner: owner, orders: [order, ...x.orders], seq: { ...x.seq, order: x.seq.order + 1 } };
  });
  return order;
}

/** Mock of the Razorpay callback. `ok=false` leaves the order PENDING_PAYMENT so the customer can retry. */
export async function confirmPayment(number: string, ok: boolean): Promise<Order> {
  if (!SITE.useMock) return real.confirmPayment(number, ok);
  await wait(700);
  const o = db.get().orders.find((x) => x.number === number);
  if (!o) throw new ApiError(404, "Order not found.");
  if (!ok) {
    db.update((x) => ({ ...x, orders: x.orders.map((y) => (y.number === number ? { ...y, paymentStatus: "FAILED" } : y)) }));
    throw new ApiError(402, "The payment didn't go through. You haven't been charged. Please try again.");
  }
  const at = new Date().toISOString();
  db.update((x) => ({
    ...x,
    orders: x.orders.map((y) =>
      y.number === number ? { ...y, paymentStatus: "PAID", status: "CONFIRMED", events: [...y.events, { status: "PLACED", at }, { status: "CONFIRMED", at, note: "Payment received." }] } : y,
    ),
  }));
  return db.get().orders.find((x) => x.number === number)!;
}

function mine(): { userId: string } {
  const s = db.get().session;
  if (!s) throw new ApiError(401, "Please log in to see your orders.");
  return s;
}

export async function listMyOrders(): Promise<Order[]> {
  if (!SITE.useMock) return real.listMyOrders();
  await wait(250);
  const s = mine();
  return db.get().orders.filter((o) => o.userId === s.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Own order for the logged-in user; a just-placed guest order is also readable by number. */
export async function getOrder(number: string): Promise<Order> {
  if (!SITE.useMock) return real.getOrder(number);
  await wait(200);
  const d = db.get();
  const o = d.orders.find((x) => x.number === number);
  if (!o) throw new ApiError(404, "We couldn't find that order.");
  if (o.userId && d.session?.userId !== o.userId && d.users.find((u) => u.id === d.session?.userId)?.role !== "admin") {
    throw new ApiError(403, "That order belongs to a different account.");
  }
  return o;
}

/** Public tracking: order number + phone (or email). Never reveals whether the number exists on mismatch. */
export async function trackOrder(number: string, contact: string): Promise<Order> {
  if (!SITE.useMock) return real.trackOrder(number, contact);
  await wait(400);
  const o = db.get().orders.find((x) => x.number.toLowerCase() === number.trim().toLowerCase());
  const c = contact.trim().toLowerCase();
  const ok = o && (o.contact.email.toLowerCase() === c || (digits(c).length >= 6 && digits(o.contact.phone).endsWith(digits(c).slice(-10))));
  if (!o || !ok) throw new ApiError(404, "We couldn't find that order. Check the number on your confirmation and the phone or email you used.");
  return o;
}

export async function cancelOrder(number: string, reason?: string): Promise<Order> {
  if (!SITE.useMock) return real.cancelOrder(number, reason);
  await wait(400);
  const o = await getOrder(number);
  if (!["PENDING_PAYMENT", "PLACED", "CONFIRMED"].includes(o.status)) throw new ApiError(400, "This order can't be cancelled any more. Message us on WhatsApp and we'll help.");
  const at = new Date().toISOString();
  db.update((x) => ({
    ...x,
    products: x.products.map((p) => {
      const back = o.items.filter((i) => i.productId === p.id);
      return back.length ? { ...p, variants: p.variants.map((v) => { const i = back.find((b) => b.colour === v.colour && b.size === v.size); return i ? { ...v, stock: v.stock + i.qty } : v; }) } : p;
    }),
    orders: x.orders.map((y) => (y.number === number ? { ...y, status: "CANCELLED", paymentStatus: y.paymentStatus === "PAID" ? "REFUNDED" : y.paymentStatus, events: [...y.events, { status: "CANCELLED", at, note: reason ?? "Cancelled at your request." }] } : y)),
  }));
  return db.get().orders.find((x) => x.number === number)!;
}

export async function requestReturn(number: string, reason: string): Promise<Order> {
  if (!SITE.useMock) return real.requestReturn(number, reason);
  await wait(400);
  const o = await getOrder(number);
  if (o.status !== "DELIVERED") throw new ApiError(400, "Returns open once an order is delivered.");
  if (o.items.some((i) => i.fulfilment === "MADE_TO_ORDER" || i.personalization)) throw new ApiError(400, "Made-to-order and personalised pieces can't be returned unless damaged. Message us on WhatsApp.");
  const at = new Date().toISOString();
  db.update((x) => ({ ...x, orders: x.orders.map((y) => (y.number === number ? { ...y, status: "RETURN_REQUESTED", events: [...y.events, { status: "RETURN_REQUESTED", at, note: reason }] } : y)) }));
  return db.get().orders.find((x) => x.number === number)!;
}
