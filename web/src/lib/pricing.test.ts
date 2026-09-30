import { describe, expect, it } from "vitest";
import { quoteCheckout, validateCoupon, zoneFor } from "./pricing";
import type { CartLine, Coupon, Product, StoreSettings } from "./types";

const settings: StoreSettings = {
  whatsapp: "911234567890",
  email: "hello@example.com",
  freeShippingAbove: 999,
  domesticShipping: 79,
  codEnabled: true,
  codCap: 2000,
  codFee: 49,
  giftWrapPrice: 59,
  intlZones: [
    { name: "Asia", countries: ["SG", "AE"], rate: 899, days: "7-12 days" },
    { name: "Rest of world", countries: ["*"], rate: 1499, days: "10-18 days" },
  ],
  depositPct: 50,
  quoteValidityDays: 7,
};

const product = (over: Partial<Product> & { id: string }): Product =>
  ({
    slug: over.id,
    price: 500,
    fulfilment: "READY",
    leadTimeDays: 2,
    variants: [{ id: `${over.id}-v`, stock: 5, priceDelta: 0 }],
    ...over,
  }) as unknown as Product;

const ready = product({ id: "ready", price: 400 });
const madeToOrder = product({ id: "mto", price: 1200, fulfilment: "MADE_TO_ORDER", leadTimeDays: 7 });
const line = (p: Product, qty = 1): CartLine => ({ productId: p.id, variantId: p.variants[0]!.id, qty });
const products = [ready, madeToOrder];

const coupon = (over: Partial<Coupon> = {}): Coupon => ({ code: "WELCOME10", kind: "PERCENT", value: 10, minCart: 0, active: true, ...over }) as Coupon;

describe("shipping", () => {
  it("charges domestic shipping under the free threshold and none above it", () => {
    expect(quoteCheckout([line(ready)], { country: "IN" }, settings, products, []).shipping).toBe(79);
    expect(quoteCheckout([line(ready, 3)], { country: "IN" }, settings, products, []).shipping).toBe(0);
  });

  it("uses the international zone rate and transit time, with a catch-all for other countries", () => {
    const sg = quoteCheckout([line(ready)], { country: "SG" }, settings, products, []);
    expect(sg.shipping).toBe(899);
    expect(sg.transitDays).toBe("7-12 days");
    expect(quoteCheckout([line(ready)], { country: "BR" }, settings, products, []).shipping).toBe(1499);
    expect(zoneFor("IN", settings)).toBeNull();
  });
});

describe("cash on delivery", () => {
  const cod = (lines: CartLine[], country = "IN", s = settings) => quoteCheckout(lines, { country, paymentMethod: "COD" }, s, products, []);

  it("is allowed for ready pieces in India under the cap, with the fee", () => {
    const q = cod([line(ready)]);
    expect(q.codEligible).toBe(true);
    expect(q.codFee).toBe(49);
    expect(q.total).toBe(400 + 79 + 49);
  });

  it.each([
    ["made-to-order pieces", () => cod([line(madeToOrder)]), /made-to-order/],
    ["outside India", () => cod([line(ready)], "SG"), /only available in India/],
    ["over the cap", () => cod([line(ready, 6)]), /up to/],
    ["when switched off", () => cod([line(ready)], "IN", { ...settings, codEnabled: false }), /switched off/],
  ])("is refused for %s", (_label, run, reason) => {
    const q = run();
    expect(q.codEligible).toBe(false);
    expect(q.codFee).toBe(0);
    expect(q.codReason).toMatch(reason);
  });
});

describe("coupons", () => {
  it("takes a percentage off the subtotal", () => {
    const q = quoteCheckout([line(ready, 2)], { country: "IN", coupon: "welcome10" }, settings, products, [coupon()]);
    expect(q.discount).toBe(80);
    expect(q.couponApplied).toBe("WELCOME10");
  });

  it("never takes more than the subtotal off, and the total never goes below zero", () => {
    const q = quoteCheckout([line(ready)], { country: "IN", coupon: "BIG" }, settings, products, [coupon({ code: "BIG", kind: "FLAT", value: 9999 })]);
    expect(q.discount).toBe(400);
    expect(q.total).toBeGreaterThanOrEqual(0);
  });

  it("explains why a code does not apply", () => {
    expect(validateCoupon("nope", 500, [coupon()]).error).toMatch(/don't recognise/);
    expect(validateCoupon("WELCOME10", 500, [coupon({ active: false })]).error).toMatch(/isn't active/);
    expect(validateCoupon("WELCOME10", 500, [coupon({ expiresAt: "2020-01-01" })]).error).toMatch(/expired/);
    expect(validateCoupon("WELCOME10", 100, [coupon({ minCart: 500 })]).error).toMatch(/Add ₹400 more/);
  });
});

describe("totals", () => {
  it("adds gift wrap and reports made-to-order lead time", () => {
    const q = quoteCheckout([line(ready), line(madeToOrder)], { country: "IN", giftWrap: true }, settings, products, []);
    expect(q.subtotal).toBe(1600);
    expect(q.giftWrap).toBe(59);
    expect(q.hasMadeToOrder).toBe(true);
    expect(q.maxLeadTimeDays).toBe(7);
    expect(q.total).toBe(1600 + 0 + 59);
  });

  it("an empty cart costs nothing and has no shipping label", () => {
    const q = quoteCheckout([], { country: "IN" }, settings, products, []);
    expect(q.total).toBe(0);
    expect(q.shippingLabel).toBe("");
    expect(q.codEligible).toBe(false);
  });
});
