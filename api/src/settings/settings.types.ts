/** Wire shape of `StoreSettings` (web/src/lib/types.ts). Every key here is safe to publish. */
export interface IntlZone {
  name: string;
  countries: string[];
  /** Flat shipping rate in whole rupees. */
  rate: number;
  /** Transit estimate text, e.g. "8–14 days". */
  days: string;
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
  intlZones: IntlZone[];
  depositPct: number;
  quoteValidityDays: number;
}

/** Same defaults as the web mock and the seed. Used for any key an admin has not stored (or stored badly). */
export const DEFAULT_SETTINGS: StoreSettings = {
  whatsapp: '910000000000',
  email: 'hello@fuzzballfactory.example',
  freeShippingAbove: 999,
  domesticShipping: 79,
  codEnabled: true,
  codCap: 2000,
  codFee: 49,
  giftWrapPrice: 59,
  depositPct: 50,
  quoteValidityDays: 7,
  intlZones: [
    { name: 'South Asia & Middle East', countries: ['NP', 'LK', 'BD', 'AE', 'SA', 'QA'], rate: 899, days: '7–12 days' },
    { name: 'UK & Europe', countries: ['GB', 'DE', 'FR', 'NL', 'IT', 'ES', 'IE'], rate: 1499, days: '8–14 days' },
    { name: 'USA, Canada & Australia', countries: ['US', 'CA', 'AU', 'NZ', 'SG', 'MY'], rate: 1799, days: '10–16 days' },
    { name: 'Rest of world', countries: ['*', 'OTHER'], rate: 1999, days: '12–20 days' },
  ],
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof StoreSettings)[];
