import type { StoreSettings } from '../settings/settings.types.js';
import { addBusinessDays } from './business-days.js';
import type { CheckoutOptions, CheckoutQuote, PricingCoupon, PricingLine, PricingProduct } from './pricing.types.js';

/**
 * The single authority for cart totals. A faithful server port of `web/src/lib/pricing.ts`
 * (`zoneFor`, `validateCoupon`, `quoteCheckout`): same rules, same wording, same rounding. The
 * client's own copy is only for instant previews; every price that is charged comes from here.
 *
 * Pure: no I/O, `now` is injectable so tests are deterministic.
 */

export function zoneFor(country: string, settings: StoreSettings) {
  if (country === 'IN') return null;
  return (
    settings.intlZones.find((z) => z.countries.includes(country)) ??
    settings.intlZones.find((z) => z.countries.includes('*')) ??
    settings.intlZones[settings.intlZones.length - 1]
  );
}

export function validateCoupon(code: string, subtotal: number, coupons: PricingCoupon[], now: Date = new Date()): { coupon?: PricingCoupon; error?: string } {
  const c = coupons.find((x) => x.code.toLowerCase() === code.trim().toLowerCase());
  if (!c) return { error: "We don't recognise that code." };
  if (!c.active) return { error: "This code isn't active." };
  if (c.expiresAt && c.expiresAt.getTime() < now.getTime()) return { error: 'This code has expired.' };
  if (c.maxUses != null && c.uses >= c.maxUses) return { error: 'This code has been fully redeemed.' };
  if (c.perUserLimit != null && (c.usedByUser ?? 0) >= c.perUserLimit) return { error: "You've already used this code." };
  if (subtotal < c.minCart) return { error: `Add ₹${c.minCart - subtotal} more to use this code.` };
  return { coupon: c };
}

/** Discount in whole rupees for a validated coupon (percent rounds half up; flat never exceeds the subtotal). */
export function couponDiscount(coupon: Pick<PricingCoupon, 'kind' | 'value'>, subtotal: number): number {
  const raw = coupon.kind === 'PERCENT' ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
  return Math.max(0, Math.min(raw, subtotal));
}

export function quoteCheckout(
  lines: PricingLine[],
  opts: CheckoutOptions,
  settings: StoreSettings,
  products: PricingProduct[],
  coupons: PricingCoupon[],
  now: Date = new Date(),
): CheckoutQuote {
  // Lines whose product or variant is unknown are not priced (the order endpoint rejects them outright).
  const items = lines
    .map((l) => {
      const p = products.find((x) => x.id === l.productId);
      const v = p?.variants.find((x) => x.id === l.variantId);
      return p && v ? { l, p, v } : undefined;
    })
    .filter((x): x is { l: PricingLine; p: PricingProduct; v: { id: string; priceDelta: number } } => !!x);

  const subtotal = items.reduce((s, { l, p, v }) => s + (p.price + v.priceDelta) * l.qty, 0);
  const hasMto = items.some(({ p }) => p.fulfilment === 'MADE_TO_ORDER');
  const maxLead = Math.max(0, ...items.map(({ p }) => p.leadTimeDays));
  const allReady = items.length > 0 && !hasMto;
  const domestic = opts.country === 'IN';
  const zone = zoneFor(opts.country, settings);

  let shipping = 0;
  let shippingLabel = 'Free shipping';
  let transitDays = '3–6 days';
  if (items.length === 0) shippingLabel = '';
  else if (domestic) {
    shipping = subtotal >= settings.freeShippingAbove ? 0 : settings.domesticShipping;
    shippingLabel = shipping === 0 ? 'Free shipping in India' : 'Standard shipping, India';
  } else if (zone) {
    shipping = zone.rate;
    shippingLabel = `International: ${zone.name}`;
    transitDays = zone.days;
  }

  let codReason: string | undefined;
  if (!settings.codEnabled) codReason = 'Cash on delivery is switched off right now.';
  else if (!domestic) codReason = 'Cash on delivery is only available in India.';
  else if (hasMto) codReason = "Cash on delivery isn't available for made-to-order pieces.";
  else if (subtotal > settings.codCap) codReason = `Cash on delivery is only for orders up to ₹${settings.codCap}.`;
  const codEligible = allReady && !codReason;

  let discount = 0;
  let couponApplied: string | undefined;
  let couponError: string | undefined;
  if (opts.coupon) {
    const r = validateCoupon(opts.coupon, subtotal, coupons, now);
    if (r.coupon) {
      discount = couponDiscount(r.coupon, subtotal);
      couponApplied = r.coupon.code;
    } else couponError = r.error;
  }

  const giftWrap = opts.giftWrap ? settings.giftWrapPrice : 0;
  const codFee = opts.paymentMethod === 'COD' && codEligible ? settings.codFee : 0;
  const total = Math.max(0, subtotal + shipping + giftWrap + codFee - discount);
  const dispatch = addBusinessDays(now, hasMto ? maxLead : 2);

  return {
    subtotal,
    shipping,
    shippingLabel,
    giftWrap,
    codFee,
    discount,
    total,
    codEligible,
    codReason,
    couponApplied,
    couponError,
    hasMadeToOrder: hasMto,
    maxLeadTimeDays: maxLead,
    estimatedDispatch: dispatch.toISOString(),
    transitDays,
  };
}
