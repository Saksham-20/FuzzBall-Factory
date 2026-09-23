import { addBusinessDays } from './business-days.js';
import { quoteCheckout, validateCoupon, zoneFor } from './pricing.engine.js';
import type { PricingCoupon, PricingProduct } from './pricing.types.js';
import { DEFAULT_SETTINGS, type StoreSettings } from '../settings/settings.types.js';

/**
 * Parity matrix for the server pricing engine. Expected numbers are worked out by hand from the rules in
 * web/src/lib/pricing.ts (the client copy) and the default settings (free shipping from ₹999, ₹79 domestic,
 * COD up to ₹2000 with a ₹49 fee, ₹59 gift wrap, intl zones), so a change to either engine that drifts fails here.
 */
const S: StoreSettings = DEFAULT_SETTINGS;
// Monday 21 Sep 2026, 11:30 IST.
const NOW = new Date('2026-09-21T06:00:00.000Z');

const mug: PricingProduct = { id: 'mug', price: 249, fulfilment: 'READY', leadTimeDays: 2, variants: [{ id: 'mug-a', priceDelta: 0 }, { id: 'mug-b', priceDelta: 50 }] };
const bag: PricingProduct = { id: 'bag', price: 1250, fulfilment: 'READY', leadTimeDays: 3, variants: [{ id: 'bag-a', priceDelta: 0 }] };
const bear: PricingProduct = { id: 'bear', price: 1450, fulfilment: 'MADE_TO_ORDER', leadTimeDays: 5, variants: [{ id: 'bear-a', priceDelta: 100 }] };
const cheap: PricingProduct = { id: 'cheap', price: 333, fulfilment: 'READY', leadTimeDays: 1, variants: [{ id: 'cheap-a', priceDelta: 0 }] };
const big: PricingProduct = { id: 'big', price: 2001, fulfilment: 'READY', leadTimeDays: 1, variants: [{ id: 'big-a', priceDelta: 0 }] };
const PRODUCTS = [mug, bag, bear, cheap, big];

const line = (variantId: string, qty = 1) => ({ productId: variantId.split('-')[0], variantId, qty });
const coupon = (over: Partial<PricingCoupon> & Pick<PricingCoupon, 'code' | 'kind' | 'value'>): PricingCoupon => ({ minCart: 0, active: true, uses: 0, ...over });
const COUPONS: PricingCoupon[] = [
  coupon({ code: 'FIRSTFUZZ', kind: 'PERCENT', value: 10 }),
  coupon({ code: 'GIFT100', kind: 'FLAT', value: 100, minCart: 999 }),
  coupon({ code: 'OFF500', kind: 'FLAT', value: 500 }),
  coupon({ code: 'EXPIRED20', kind: 'PERCENT', value: 20, active: false }),
  coupon({ code: 'OLD', kind: 'PERCENT', value: 20, expiresAt: new Date('2026-09-01T00:00:00Z') }),
  coupon({ code: 'FIVE', kind: 'PERCENT', value: 5 }),
  coupon({ code: 'USEDUP', kind: 'FLAT', value: 50, uses: 10, maxUses: 10 }),
  coupon({ code: 'ONCE', kind: 'FLAT', value: 50, perUserLimit: 1, usedByUser: 1 }),
];

const quote = (lines: ReturnType<typeof line>[], o: Partial<Parameters<typeof quoteCheckout>[1]> = {}, settings = S) =>
  quoteCheckout(lines, { country: 'IN', ...o }, settings, PRODUCTS, COUPONS, NOW);

describe('quoteCheckout: India, shipping and totals', () => {
  it('charges domestic shipping under the free-shipping threshold', () => {
    const q = quote([line('mug-a', 2)]);
    expect(q).toMatchObject({ subtotal: 498, shipping: 79, shippingLabel: 'Standard shipping, India', giftWrap: 0, codFee: 0, discount: 0, total: 577, transitDays: '3–6 days' });
    expect(q.hasMadeToOrder).toBe(false);
    expect(q.maxLeadTimeDays).toBe(2);
  });

  it('adds the variant price delta', () => {
    expect(quote([line('mug-b', 1)])).toMatchObject({ subtotal: 299, total: 378 });
  });

  it('is free from exactly the threshold, not below it', () => {
    expect(quote([line('bag-a')])).toMatchObject({ subtotal: 1250, shipping: 0, shippingLabel: 'Free shipping in India', total: 1250 });
    const atThreshold = { ...S, freeShippingAbove: 498 };
    expect(quote([line('mug-a', 2)], {}, atThreshold).shipping).toBe(0);
    expect(quote([line('mug-a', 2)], {}, { ...S, freeShippingAbove: 499 }).shipping).toBe(79);
  });

  it('sums duplicate lines and ignores unknown products/variants', () => {
    const q = quote([line('mug-a', 1), line('mug-a', 1), { productId: 'ghost', variantId: 'ghost-a', qty: 3 }, { productId: 'mug', variantId: 'nope', qty: 1 }]);
    expect(q.subtotal).toBe(498);
  });

  it('an empty basket costs nothing and has no shipping label', () => {
    expect(quote([])).toMatchObject({ subtotal: 0, shipping: 0, shippingLabel: '', total: 0, codEligible: false, maxLeadTimeDays: 0 });
  });

  it('adds gift wrap', () => {
    expect(quote([line('bag-a')], { giftWrap: true })).toMatchObject({ giftWrap: 59, total: 1309 });
  });
});

describe('quoteCheckout: international', () => {
  it.each([
    ['GB', 'UK & Europe', 1499, '8–14 days'],
    ['US', 'USA, Canada & Australia', 1799, '10–16 days'],
    ['AE', 'South Asia & Middle East', 899, '7–12 days'],
    ['ZZ', 'Rest of world', 1999, '12–20 days'],
    ['OTHER', 'Rest of world', 1999, '12–20 days'],
  ])('%s uses the %s zone', (country, zone, rate, days) => {
    const q = quote([line('bag-a')], { country });
    expect(q).toMatchObject({ shipping: rate, shippingLabel: `International: ${zone}`, transitDays: days, total: 1250 + rate });
  });

  it('never applies the free-shipping threshold abroad', () => {
    expect(quote([line('big-a')], { country: 'GB' }).shipping).toBe(1499);
  });

  it('zoneFor: India has no zone; unknown countries fall back to the wildcard zone', () => {
    expect(zoneFor('IN', S)).toBeNull();
    expect(zoneFor('BR', S)?.name).toBe('Rest of world');
  });
});

describe('quoteCheckout: COD eligibility and fee', () => {
  it('ready-only India order under the cap is eligible; the fee applies only when COD is chosen', () => {
    expect(quote([line('mug-a', 2)])).toMatchObject({ codEligible: true, codFee: 0 });
    const cod = quote([line('mug-a', 2)], { paymentMethod: 'COD' });
    expect(cod).toMatchObject({ codEligible: true, codFee: 49, total: 626 });
    expect(cod.codReason).toBeUndefined();
  });

  it('made-to-order pieces block COD', () => {
    const q = quote([line('mug-a'), line('bear-a')], { paymentMethod: 'COD' });
    expect(q).toMatchObject({ codEligible: false, codFee: 0, hasMadeToOrder: true, maxLeadTimeDays: 5 });
    expect(q.codReason).toBe("Cash on delivery isn't available for made-to-order pieces.");
  });

  it('is capped at the COD limit (inclusive)', () => {
    const over = quote([line('big-a')], { paymentMethod: 'COD' });
    expect(over).toMatchObject({ codEligible: false, codFee: 0 });
    expect(over.codReason).toBe('Cash on delivery is only for orders up to ₹2000.');
    expect(quote([line('big-a')], { paymentMethod: 'COD' }, { ...S, codCap: 2001 }).codEligible).toBe(true);
  });

  it('is India only', () => {
    expect(quote([line('mug-a')], { country: 'GB', paymentMethod: 'COD' }).codReason).toBe('Cash on delivery is only available in India.');
  });

  it('can be switched off', () => {
    const q = quote([line('mug-a')], { paymentMethod: 'COD' }, { ...S, codEnabled: false });
    expect(q).toMatchObject({ codEligible: false, codFee: 0, codReason: 'Cash on delivery is switched off right now.' });
  });
});

describe('coupons', () => {
  it('percent coupons round half up on the subtotal', () => {
    expect(quote([line('mug-a', 2)], { coupon: 'FIRSTFUZZ' })).toMatchObject({ discount: 50, couponApplied: 'FIRSTFUZZ', total: 527 }); // 49.8 -> 50
    expect(quote([line('cheap-a')], { coupon: 'FIVE' }).discount).toBe(17); // 16.65 -> 17
  });

  it('flat coupons respect the minimum cart and never exceed the subtotal', () => {
    const ok = quote([line('bag-a')], { coupon: 'GIFT100' });
    expect(ok).toMatchObject({ discount: 100, couponApplied: 'GIFT100', total: 1150 });
    const short = quote([line('mug-a', 2)], { coupon: 'GIFT100' });
    expect(short).toMatchObject({ discount: 0, couponError: 'Add ₹501 more to use this code.' });
    expect(short.couponApplied).toBeUndefined();
    expect(quote([line('mug-a')], { coupon: 'OFF500' })).toMatchObject({ discount: 249, total: 79 }); // 249 + 79 - 249
  });

  it('matches codes case-insensitively and ignores surrounding spaces', () => {
    expect(quote([line('mug-a')], { coupon: '  firstfuzz ' }).couponApplied).toBe('FIRSTFUZZ');
  });

  it.each([
    ['NOPE', "We don't recognise that code."],
    ['EXPIRED20', "This code isn't active."],
    ['OLD', 'This code has expired.'],
    ['USEDUP', 'This code has been fully redeemed.'],
    ['ONCE', "You've already used this code."],
  ])('rejects %s', (code, error) => {
    const q = quote([line('bag-a')], { coupon: code });
    expect(q).toMatchObject({ discount: 0, couponError: error });
    expect(q.couponApplied).toBeUndefined();
  });

  it('validateCoupon: a coupon expiring in the future is valid', () => {
    const r = validateCoupon('x', 100, [coupon({ code: 'X', kind: 'FLAT', value: 10, expiresAt: new Date('2026-12-01T00:00:00Z') })], NOW);
    expect(r.coupon?.code).toBe('X');
  });

  it('a coupon is applied to the subtotal only, before shipping and fees', () => {
    // 249 + 79 shipping + 49 COD + 59 wrap - 25 (10% of 249) = 411
    const q = quote([line('mug-a')], { coupon: 'FIRSTFUZZ', giftWrap: true, paymentMethod: 'COD' });
    expect(q).toMatchObject({ subtotal: 249, shipping: 79, codFee: 49, giftWrap: 59, discount: 25, total: 411 });
  });
});

describe('estimated dispatch', () => {
  it('ready pieces dispatch in 2 business days', () => {
    expect(quote([line('mug-a')]).estimatedDispatch).toBe('2026-09-23T06:00:00.000Z'); // Mon -> Wed
  });

  it('made-to-order dispatches after the longest lead time, skipping Sundays', () => {
    expect(quote([line('bear-a')]).estimatedDispatch).toBe('2026-09-26T06:00:00.000Z'); // Mon + 5 = Sat
    expect(quote([line('bear-a')]).maxLeadTimeDays).toBe(5);
  });

  it('addBusinessDays skips Sunday (IST)', () => {
    expect(addBusinessDays(new Date('2026-09-25T06:00:00.000Z'), 2).toISOString()).toBe('2026-09-28T06:00:00.000Z'); // Fri +2 -> Sat, Mon
    expect(addBusinessDays(new Date('2026-09-26T06:00:00.000Z'), 1).toISOString()).toBe('2026-09-28T06:00:00.000Z'); // Sat +1 -> Mon
    expect(addBusinessDays(NOW, 0).toISOString()).toBe(NOW.toISOString());
  });

  it('counts weekdays in IST, not UTC', () => {
    // 23:30 UTC on Saturday is already Sunday 05:00 IST. +1 business day is Monday 05:00 IST (= Sunday 23:30 UTC).
    // Counting in UTC it would be Saturday, so "next day" would land on the maker's Sunday off.
    expect(addBusinessDays(new Date('2026-09-26T23:30:00.000Z'), 1).toISOString()).toBe('2026-09-27T23:30:00.000Z');
  });
});

describe('server authority', () => {
  it('has no way to accept a client price: totals depend only on catalogue prices and quantities', () => {
    const forged = { ...line('mug-a', 1), price: 1, unitPrice: 1 } as ReturnType<typeof line>;
    expect(quote([forged]).subtotal).toBe(249);
  });
});
