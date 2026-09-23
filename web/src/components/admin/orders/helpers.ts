import { formatDate, formatINR } from "@/lib/format";
import { COUNTRIES, CUSTOM_STATUS, ORDER_STATUS } from "@/lib/status";
import type { CustomStatus, Order, OrderStatus, PaymentStatus } from "@/lib/types";
import { firstName, waToCustomer } from "./wa";

export type OrderTab = "ALL" | "TO_CONFIRM" | "TO_MAKE" | "TO_PACK" | "SHIPPED" | "DELIVERED" | "ENDED";

export const ORDER_TABS: { value: OrderTab; label: string; /** value passed to listAdminOrders */ api?: OrderStatus | "TO_CONFIRM" | "TO_MAKE" | "TO_PACK" }[] = [
  { value: "ALL", label: "All" },
  { value: "TO_CONFIRM", label: "To confirm", api: "TO_CONFIRM" },
  { value: "TO_MAKE", label: "To make", api: "TO_MAKE" },
  { value: "TO_PACK", label: "To pack", api: "TO_PACK" },
  { value: "SHIPPED", label: "Shipped", api: "SHIPPED" },
  { value: "DELIVERED", label: "Delivered", api: "DELIVERED" },
  // No single API status covers these, so this tab fetches everything and filters here.
  { value: "ENDED", label: "Cancelled & returns" },
];

export const ENDED_STATUSES: OrderStatus[] = ["CANCELLED", "RETURN_REQUESTED", "REFUNDED"];

export const isOrderTab = (v: string | null): v is OrderTab => ORDER_TABS.some((t) => t.value === v);

export const paymentMethodLabel = (o: Pick<Order, "paymentMethod">) => (o.paymentMethod === "COD" ? "Cash on delivery" : "Razorpay");

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  PENDING: "Payment pending",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
  COD_DUE: "Collect on delivery",
};

export const itemCount = (o: Order) => o.items.reduce((s, i) => s + i.qty, 0);
export const itemsLabel = (o: Order) => `${itemCount(o)} ${itemCount(o) === 1 ? "item" : "items"}`;
export const isGift = (o: Order) => !!o.giftNote?.trim();
export const isCodToConfirm = (o: Order) => o.paymentMethod === "COD" && o.status === "PLACED";
export const hasMadeToOrder = (o: Order) => o.items.some((i) => i.fulfilment === "MADE_TO_ORDER");

export const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;

/** One-line address for copying to a courier form. */
export function addressText(o: Order) {
  const a = o.address;
  return [a.name, a.line1, a.line2, `${a.city}, ${a.state} ${a.postalCode}`, countryName(a.country), a.phone].filter(Boolean).join("\n");
}

/** A WhatsApp message to the customer, worded for where the order is right now. */
export function orderWhatsApp(o: Order): { href: string; label: string } {
  const hi = `Hi ${firstName(o.contact.name)}! This is FuzzBall Factory.`;
  const ref = `order ${o.number}`;
  let text: string;
  let label = "Message on WhatsApp";
  switch (o.status) {
    case "PLACED":
      if (o.paymentMethod === "COD") {
        label = "Confirm on WhatsApp";
        text = `${hi} Your ${ref} (${formatINR(o.total)}, cash on delivery to ${o.address.city}) is ready for us to start. Can you confirm you'd like us to go ahead? A quick "yes" is all we need.`;
      } else text = `${hi} We've received your ${ref}. We'll confirm it shortly.`;
      break;
    case "PENDING_PAYMENT":
      text = `${hi} Your ${ref} is waiting for payment. Need any help finishing it?`;
      break;
    case "CONFIRMED":
    case "IN_PRODUCTION":
      text = `${hi} Quick update on ${ref}: it's being made for you. We expect to dispatch around ${formatDate(o.estimatedDispatch)}.`;
      break;
    case "PACKED":
      text = `${hi} Your ${ref} is packed and waiting for the courier. We'll send the tracking details soon.`;
      break;
    case "SHIPPED":
      text = `${hi} Your ${ref} is on its way with ${o.courier ?? "the courier"}${o.awb ? `, tracking number ${o.awb}` : ""}.`;
      break;
    case "DELIVERED":
      text = `${hi} Your ${ref} should have reached you. We'd love to hear how it looks. A photo would make our day!`;
      break;
    case "RETURN_REQUESTED":
      text = `${hi} About the return for ${ref}: could you send a photo or unboxing video so we can sort it out quickly?`;
      break;
    default:
      text = `${hi} A quick note about ${ref}.`;
  }
  return { href: waToCustomer(o.contact.phone, text), label };
}

export const ORDER_ACTION_COPY: Partial<Record<OrderStatus, { label: string; done: string }>> = {
  CONFIRMED: { label: "Confirm order", done: "Order confirmed." },
  IN_PRODUCTION: { label: "Start production", done: "Production started." },
  PACKED: { label: "Mark packed", done: "Marked as packed." },
  SHIPPED: { label: "Ship order", done: "Order shipped." },
  DELIVERED: { label: "Mark delivered", done: "Marked as delivered." },
};

export const CANCEL_REASONS = [
  "Customer asked to cancel",
  "Couldn't reach the customer on WhatsApp",
  "Piece is no longer available",
  "Payment didn't go through",
] as const;

/** Compact stamp for dense rows. Round (money) stamps keep their designed size so the shape still reads. */
export const rowStampClass = (status: OrderStatus | CustomStatus) => {
  const shape = (ORDER_STATUS as Record<string, { shape: string }>)[status]?.shape ?? (CUSTOM_STATUS as Record<string, { shape: string }>)[status]?.shape;
  return shape === "circle" ? "self-start" : "px-2 py-1 text-[11px] whitespace-nowrap";
};
