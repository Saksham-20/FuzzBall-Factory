import type { CustomStatus, OrderStatus } from "@/lib/types";
import type { StampShape, StampTone } from "@/components/brand/Stamp";

export interface StatusMeta {
  label: string;
  tone: StampTone;
  shape: StampShape;
  /** Short customer-facing explanation. */
  hint: string;
}

/** Shape differs per family (rect = progress, circle = money, ticket = ended) so colour is never the only signal. */
export const ORDER_STATUS: Record<OrderStatus, StatusMeta> = {
  PENDING_PAYMENT: { label: "Awaiting payment", tone: "warn", shape: "ticket", hint: "We're waiting for your payment to go through." },
  PLACED: { label: "Placed", tone: "ink", shape: "rect", hint: "We've got your order." },
  CONFIRMED: { label: "Confirmed", tone: "ink", shape: "rect", hint: "Confirmed and in the queue." },
  IN_PRODUCTION: { label: "In production", tone: "live", shape: "rect", hint: "Being crocheted for you right now." },
  PACKED: { label: "Packed", tone: "ink", shape: "rect", hint: "Packed and waiting for the courier." },
  SHIPPED: { label: "Shipped", tone: "live", shape: "rect", hint: "On its way to you." },
  DELIVERED: { label: "Delivered", tone: "ok", shape: "circle", hint: "Delivered. Enjoy!" },
  CANCELLED: { label: "Cancelled", tone: "err", shape: "ticket", hint: "This order was cancelled." },
  RETURN_REQUESTED: { label: "Return requested", tone: "warn", shape: "ticket", hint: "We're reviewing your return request." },
  REFUNDED: { label: "Refunded", tone: "ink", shape: "circle", hint: "Your refund has been issued." },
};

export const CUSTOM_STATUS: Record<CustomStatus, StatusMeta> = {
  REQUESTED: { label: "Requested", tone: "ink", shape: "rect", hint: "We've received your work order." },
  UNDER_REVIEW: { label: "Under review", tone: "ink", shape: "rect", hint: "We're looking at your idea." },
  QUOTED: { label: "Quote ready", tone: "live", shape: "circle", hint: "A quote is waiting for you to accept, counter or decline." },
  COUNTERED: { label: "Counter sent", tone: "warn", shape: "circle", hint: "We're reviewing your counter-offer." },
  ACCEPTED: { label: "Accepted", tone: "ok", shape: "rect", hint: "Quote accepted." },
  DEPOSIT_PENDING: { label: "Deposit due", tone: "live", shape: "circle", hint: "Pay the advance to start your piece." },
  IN_QUEUE: { label: "In the queue", tone: "ink", shape: "rect", hint: "Deposit received. Your piece is next in line." },
  IN_PROGRESS: { label: "In progress", tone: "live", shape: "rect", hint: "Being crocheted. Check the progress photos." },
  AWAITING_APPROVAL: { label: "Approve final", tone: "live", shape: "rect", hint: "Your finished piece is ready for your approval." },
  BALANCE_PENDING: { label: "Balance due", tone: "live", shape: "circle", hint: "Pay the balance and we'll ship it." },
  READY_TO_SHIP: { label: "Ready to ship", tone: "ok", shape: "rect", hint: "Paid in full and ready to go." },
  SHIPPED: { label: "Shipped", tone: "live", shape: "rect", hint: "On its way to you." },
  DELIVERED: { label: "Delivered", tone: "ok", shape: "circle", hint: "Delivered. Enjoy!" },
  CLOSED: { label: "Closed", tone: "ink", shape: "ticket", hint: "This work order is complete." },
  DECLINED: { label: "Declined", tone: "err", shape: "ticket", hint: "We couldn't take this one on." },
  EXPIRED: { label: "Quote expired", tone: "warn", shape: "ticket", hint: "The quote expired. Message us to reopen it." },
  CANCELLED: { label: "Cancelled", tone: "err", shape: "ticket", hint: "This work order was cancelled." },
};

/** Ordered stations for the order timeline (made-to-order only shows IN_PRODUCTION). */
export const ORDER_FLOW: { key: OrderStatus; label: string; mtoOnly?: boolean }[] = [
  { key: "PLACED", label: "Placed" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "IN_PRODUCTION", label: "In production", mtoOnly: true },
  { key: "PACKED", label: "Packed" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "DELIVERED", label: "Delivered" },
];

export const CUSTOM_FLOW: { key: CustomStatus; label: string }[] = [
  { key: "REQUESTED", label: "Requested" },
  { key: "QUOTED", label: "Quoted" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "DEPOSIT_PENDING", label: "Deposit" },
  { key: "IN_PROGRESS", label: "Crocheting" },
  { key: "AWAITING_APPROVAL", label: "Approval" },
  { key: "BALANCE_PENDING", label: "Balance" },
  { key: "SHIPPED", label: "Shipped" },
  { key: "DELIVERED", label: "Delivered" },
];

/** Where a custom status sits in CUSTOM_FLOW (for the timeline "current" marker). */
export function customFlowIndex(s: CustomStatus): number {
  const order: CustomStatus[] = ["REQUESTED", "UNDER_REVIEW", "QUOTED", "COUNTERED", "ACCEPTED", "DEPOSIT_PENDING", "IN_QUEUE", "IN_PROGRESS", "AWAITING_APPROVAL", "BALANCE_PENDING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CLOSED"];
  const map: Partial<Record<CustomStatus, number>> = {
    REQUESTED: 0, UNDER_REVIEW: 0, QUOTED: 1, COUNTERED: 1, ACCEPTED: 2, DEPOSIT_PENDING: 3, IN_QUEUE: 4,
    IN_PROGRESS: 4, AWAITING_APPROVAL: 5, BALANCE_PENDING: 6, READY_TO_SHIP: 6, SHIPPED: 7, DELIVERED: 8, CLOSED: 8,
  };
  void order;
  return map[s] ?? 0;
}

export const OCCASIONS = ["Birthday", "Anniversary", "Valentine's", "Baby shower", "Rakhi", "Graduation", "Just because"] as const;

/** ISO country → intl zone is resolved in pricing.ts via settings.intlZones. */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" }, { code: "CA", name: "Canada" }, { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" }, { code: "AE", name: "United Arab Emirates" }, { code: "SG", name: "Singapore" },
  { code: "DE", name: "Germany" }, { code: "FR", name: "France" }, { code: "NL", name: "Netherlands" },
  { code: "IT", name: "Italy" }, { code: "ES", name: "Spain" }, { code: "IE", name: "Ireland" },
  { code: "NZ", name: "New Zealand" }, { code: "NP", name: "Nepal" }, { code: "LK", name: "Sri Lanka" },
  { code: "BD", name: "Bangladesh" }, { code: "SA", name: "Saudi Arabia" }, { code: "QA", name: "Qatar" },
  { code: "MY", name: "Malaysia" }, { code: "OTHER", name: "Other country" },
];

export const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand",
  "Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan",
  "Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Jammu and Kashmir","Ladakh",
  "Chandigarh","Puducherry","Andaman and Nicobar Islands","Dadra and Nagar Haveli and Daman and Diu","Lakshadweep",
];
