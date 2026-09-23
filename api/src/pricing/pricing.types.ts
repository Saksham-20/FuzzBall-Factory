import type { PaymentMethod } from '../generated/prisma/enums.js';

/** Mirrors web `CartLine`. */
export interface PricingLine {
  productId: string;
  variantId: string;
  qty: number;
  personalization?: string;
}

/** The slice of a product the engine needs. */
export interface PricingProduct {
  id: string;
  price: number;
  fulfilment: 'READY' | 'MADE_TO_ORDER';
  leadTimeDays: number;
  variants: { id: string; priceDelta: number }[];
}

export interface PricingCoupon {
  code: string;
  kind: 'PERCENT' | 'FLAT';
  value: number;
  minCart: number;
  active: boolean;
  expiresAt?: Date | null;
  uses: number;
  maxUses?: number | null;
  perUserLimit?: number | null;
  /** How many times the current user already redeemed it (only needed when `perUserLimit` is set). */
  usedByUser?: number;
}

/** Mirrors web `CheckoutOptions`. */
export interface CheckoutOptions {
  country: string;
  giftWrap?: boolean;
  coupon?: string;
  paymentMethod?: PaymentMethod;
}

/** Mirrors web `CheckoutQuote` exactly (rupee Ints, ISO date string). */
export interface CheckoutQuote {
  subtotal: number;
  shipping: number;
  shippingLabel: string;
  giftWrap: number;
  codFee: number;
  discount: number;
  total: number;
  codEligible: boolean;
  /** Why COD is unavailable, when it is. */
  codReason?: string;
  couponApplied?: string;
  couponError?: string;
  hasMadeToOrder: boolean;
  maxLeadTimeDays: number;
  /** ISO date. */
  estimatedDispatch: string;
  /** Transit estimate text, e.g. "3–6 days". */
  transitDays: string;
}
