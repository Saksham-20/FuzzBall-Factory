export type Fulfilment = "READY" | "MADE_TO_ORDER";
export type ProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type Role = "customer" | "admin";

export interface Category {
  slug: string;
  name: string;
  /** Big cropped word used as the category door on the home page. */
  word: string;
  blurb: string;
  image: string;
}

export interface Swatch {
  name: string;
  hex: string;
}

export interface ProductVariant {
  id: string;
  colour: string;
  size?: string;
  priceDelta: number;
  stock: number;
}

export interface Product {
  id: string;
  slug: string;
  batch: number;
  name: string;
  tagline: string;
  description: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  fulfilment: Fulfilment;
  leadTimeDays: number;
  fiber: string;
  sizeCm: string;
  weightG: number;
  care: string[];
  images: { src: string; alt: string }[];
  swatches: Swatch[];
  variants: ProductVariant[];
  isOneOfAKind: boolean;
  customizable: boolean;
  giftable: boolean;
  occasions: string[];
  tags: string[];
  status: ProductStatus;
  /** True while the product is dev sample data, not a real listing. */
  sample?: boolean;
  rating?: { average: number; count: number };
  createdAt: string;
}

export interface CartLine {
  productId: string;
  variantId: string;
  qty: number;
  personalization?: string;
}

export interface Address {
  id: string;
  label: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  createdAt: string;
}

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PLACED"
  | "CONFIRMED"
  | "IN_PRODUCTION"
  | "PACKED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURN_REQUESTED"
  | "REFUNDED";

export type PaymentMethod = "RAZORPAY" | "COD";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "COD_DUE";

export interface OrderItem {
  productId: string;
  name: string;
  image: string;
  colour: string;
  size?: string;
  qty: number;
  unitPrice: number;
  fulfilment: Fulfilment;
  personalization?: string;
}

export interface TimelineEvent {
  status: string;
  at: string;
  note?: string;
  photo?: string;
}

export interface Order {
  number: string;
  userId?: string;
  contact: { name: string; email: string; phone: string };
  address: Omit<Address, "id" | "label">;
  items: OrderItem[];
  subtotal: number;
  shipping: number;
  codFee: number;
  giftWrap: number;
  discount: number;
  total: number;
  currency: "INR";
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  giftNote?: string;
  estimatedDispatch: string;
  courier?: string;
  awb?: string;
  events: TimelineEvent[];
  createdAt: string;
}

export type CustomStatus =
  | "REQUESTED"
  | "UNDER_REVIEW"
  | "QUOTED"
  | "COUNTERED"
  | "ACCEPTED"
  | "DEPOSIT_PENDING"
  | "IN_QUEUE"
  | "IN_PROGRESS"
  | "AWAITING_APPROVAL"
  | "BALANCE_PENDING"
  | "READY_TO_SHIP"
  | "SHIPPED"
  | "DELIVERED"
  | "CLOSED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED";

export type QuoteStatus = "SENT" | "COUNTERED" | "ACCEPTED" | "DECLINED" | "EXPIRED";

export interface Quote {
  id: string;
  price: number;
  depositPct: number;
  breakdown: { label: string; amount: number }[];
  timelineDays: number;
  revisions: number;
  scope: string;
  validUntil: string;
  status: QuoteStatus;
  counter?: { amount: number; note: string; at: string };
  createdAt: string;
}

export interface CustomMessage {
  id: string;
  author: "customer" | "maker";
  body: string;
  attachments?: string[];
  at: string;
}

export interface CustomRequest {
  number: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  kind: "NEW" | "CUSTOMIZE";
  baseProductSlug?: string;
  category: string;
  title: string;
  description: string;
  colours: string[];
  size: string;
  quantity: number;
  budgetMin: number;
  budgetMax: number;
  neededBy?: string;
  occasion?: string;
  personalization?: string;
  references: string[];
  country: string;
  postalCode: string;
  status: CustomStatus;
  quotes: Quote[];
  messages: CustomMessage[];
  events: TimelineEvent[];
  createdAt: string;
}

export interface Review {
  id: string;
  productId: string;
  author: string;
  rating: number;
  body: string;
  verified: boolean;
  status: "PENDING" | "PUBLISHED" | "HIDDEN" | "DISPUTED";
  createdAt: string;
  /** The maker's public reply, shown under the review on the product page. */
  reply?: string;
  repliedAt?: string;
  /** Required when status is DISPUTED: why the maker is contesting this review. Never shown publicly. */
  disputeReason?: string;
}

export interface Coupon {
  code: string;
  kind: "PERCENT" | "FLAT";
  value: number;
  minCart: number;
  active: boolean;
  uses: number;
  expiresAt?: string;
}

export interface Material {
  id: string;
  /** e.g. "Cotton yarn, cream, 100g skein". */
  name: string;
  /** Free text: materials vary too much for a fixed enum ("skein", "gram", "piece", "metre", ...). */
  unit: string;
  /** Rupees, whole. */
  costPerUnit: number;
  /** Fractional quantity on hand (yarn is tracked in partial skeins/grams). */
  qtyOnHand: number;
  /** Threshold at/below which the maker is shown a "running low" flag. */
  lowStockAt?: number;
  notes?: string;
  /** Soft delete, same pattern as product archiving. */
  archived: boolean;
  /** True while this is dev sample data, not the maker's real stock. */
  sample?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreSettings {
  whatsapp: string;
  email: string;
  freeShippingAbove: number;
  domesticShipping: number;
  codEnabled: boolean;
  codCap: number;
  codFee: number;
  giftWrapPrice: number;
  intlZones: { name: string; countries: string[]; rate: number; days: string }[];
  depositPct: number;
  quoteValidityDays: number;
}
