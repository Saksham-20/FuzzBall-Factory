/**
 * ADAPTER SEAM: courier serviceability and transit estimates.
 *
 * `ShippingService` asks a `ShippingProvider` whether a destination is serviceable. Today the only
 * implementation is `TableShippingProvider` (a flat 3-6 day domestic estimate and the intl zone table
 * from settings). To use Shiprocket for India:
 *   1. write `ShiprocketShippingProvider implements ShippingProvider` (POST /v1/external/courier/serviceability
 *      with pickup pincode, delivery pincode, weight, cod flag; map the fastest courier's `estimated_delivery_days`
 *      to `transitBusinessDays`, and `serviceable` to whether any courier was returned),
 *   2. provide it under `SHIPPING_PROVIDER` in shipping.module.ts instead of `TableShippingProvider`,
 *   3. keep `TableShippingProvider` as the fallback when Shiprocket errors or times out.
 * Nothing else changes: controllers and the checkout pricing engine do not know which provider is in use.
 */
export interface ShippingLookup {
  /** ISO alpha-2 country, or "OTHER". */
  country: string;
  postalCode: string;
  /** Whether every item is ready to ship (courier COD needs this). */
  ready?: boolean;
}

export interface ShippingQuote {
  serviceable: boolean;
  /** Set when not serviceable, e.g. an invalid pincode. */
  message?: string;
  /** Business days in transit (added to the product's lead time for the ETA). */
  transitBusinessDays: number;
  /** Human transit estimate, e.g. "3–6 days". */
  transitLabel: string;
}

export interface ShippingProvider {
  /** Return `null` to let the caller fall back to the default table estimate. */
  check(lookup: ShippingLookup): Promise<ShippingQuote | null>;
}

export const SHIPPING_PROVIDER = Symbol('SHIPPING_PROVIDER');

/** Placeholder provider: no courier is contacted; `ShippingService` applies the default estimates. */
export class TableShippingProvider implements ShippingProvider {
  check(): Promise<ShippingQuote | null> {
    return Promise.resolve(null);
  }
}
