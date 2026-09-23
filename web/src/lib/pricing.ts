import type { CartLine, Coupon, PaymentMethod, Product, StoreSettings } from "@/lib/types";
import { addBusinessDays } from "@/lib/format";

export interface CheckoutOptions {
  country: string;
  giftWrap?: boolean;
  coupon?: string;
  paymentMethod?: PaymentMethod;
}

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

export function zoneFor(country: string, settings: StoreSettings) {
  if (country === "IN") return null;
  return (
    settings.intlZones.find((z) => z.countries.includes(country)) ??
    settings.intlZones.find((z) => z.countries.includes("*")) ??
    settings.intlZones[settings.intlZones.length - 1]
  );
}

export function validateCoupon(code: string, subtotal: number, coupons: Coupon[]): { coupon?: Coupon; error?: string } {
  const c = coupons.find((x) => x.code.toLowerCase() === code.trim().toLowerCase());
  if (!c) return { error: "We don't recognise that code." };
  if (!c.active) return { error: "This code isn't active." };
  if (c.expiresAt && new Date(c.expiresAt) < new Date()) return { error: "This code has expired." };
  if (subtotal < c.minCart) return { error: `Add ₹${c.minCart - subtotal} more to use this code.` };
  return { coupon: c };
}

/** Single source of truth for cart totals. The real API recomputes this server-side. */
export function quoteCheckout(
  lines: CartLine[],
  opts: CheckoutOptions,
  settings: StoreSettings,
  products: Product[],
  coupons: Coupon[],
): CheckoutQuote {
  const items = lines
    .map((l) => ({ l, p: products.find((p) => p.id === l.productId) }))
    .filter((x): x is { l: CartLine; p: Product } => !!x.p);
  const subtotal = items.reduce((s, { l, p }) => {
    const v = p.variants.find((x) => x.id === l.variantId);
    return s + (p.price + (v?.priceDelta ?? 0)) * l.qty;
  }, 0);
  const hasMto = items.some(({ p }) => p.fulfilment === "MADE_TO_ORDER");
  const maxLead = Math.max(0, ...items.map(({ p }) => p.leadTimeDays));
  const allReady = items.length > 0 && !hasMto;
  const domestic = opts.country === "IN";
  const zone = zoneFor(opts.country, settings);

  let shipping = 0;
  let shippingLabel = "Free shipping";
  let transitDays = "3–6 days";
  if (items.length === 0) shippingLabel = "";
  else if (domestic) {
    shipping = subtotal >= settings.freeShippingAbove ? 0 : settings.domesticShipping;
    shippingLabel = shipping === 0 ? "Free shipping in India" : "Standard shipping, India";
  } else if (zone) {
    shipping = zone.rate;
    shippingLabel = `International: ${zone.name}`;
    transitDays = zone.days;
  }

  let codReason: string | undefined;
  if (!settings.codEnabled) codReason = "Cash on delivery is switched off right now.";
  else if (!domestic) codReason = "Cash on delivery is only available in India.";
  else if (hasMto) codReason = "Cash on delivery isn't available for made-to-order pieces.";
  else if (subtotal > settings.codCap) codReason = `Cash on delivery is only for orders up to ₹${settings.codCap}.`;
  const codEligible = allReady && !codReason;

  let discount = 0;
  let couponApplied: string | undefined;
  let couponError: string | undefined;
  if (opts.coupon) {
    const r = validateCoupon(opts.coupon, subtotal, coupons);
    if (r.coupon) {
      discount = r.coupon.kind === "PERCENT" ? Math.round((subtotal * r.coupon.value) / 100) : Math.min(r.coupon.value, subtotal);
      couponApplied = r.coupon.code;
    } else couponError = r.error;
  }

  const giftWrap = opts.giftWrap ? settings.giftWrapPrice : 0;
  const codFee = opts.paymentMethod === "COD" && codEligible ? settings.codFee : 0;
  const total = Math.max(0, subtotal + shipping + giftWrap + codFee - discount);
  const dispatch = addBusinessDays(new Date(), hasMto ? maxLead : 2);

  return {
    subtotal, shipping, shippingLabel, giftWrap, codFee, discount, total, codEligible, codReason,
    couponApplied, couponError, hasMadeToOrder: hasMto, maxLeadTimeDays: maxLead,
    estimatedDispatch: dispatch.toISOString(), transitDays,
  };
}
