/**
 * Site-wide constants.
 * Every value tagged PLACEHOLDER(id) must be replaced before launch;
 * see docs/PLACEHOLDERS.md.
 */
export const SITE = {
  name: "FuzzBall Factory",
  tagline: "Handmade with love",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  // PLACEHOLDER(whatsapp-number): digits only, with country code (e.g. 919876543210)
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP ?? "910000000000",
  // PLACEHOLDER(contact-email)
  email: "hello@fuzzballfactory.example",
  // PLACEHOLDER(instagram): handle read off the stall's QR card (@fuzzballfactory); confirm it before launch
  instagram: "https://www.instagram.com/fuzzballfactory",
  useMock: process.env.NEXT_PUBLIC_USE_MOCK !== "false",
  // India only at launch (the owner's decision, 2026-10-03). Set NEXT_PUBLIC_SHIPS_INTERNATIONAL=true once overseas card
  // payments and export invoices are in place (TODOS.md): shipping copy, the FAQ and every country picker follow it.
  shipsInternational: process.env.NEXT_PUBLIC_SHIPS_INTERNATIONAL === "true",
} as const;

/**
 * PLACEHOLDER(shipping-rates): sample numbers from docs/PLAN.md, confirm with the maker.
 * These will move to admin Settings in the backend phase.
 */
export const SAMPLE_SETTINGS = {
  freeShippingAbove: 999,
  domesticShipping: 79,
  intlFrom: 899,
  giftWrapPrice: 59,
  codCap: 2000,
  codFee: 49,
  depositPct: 50,
} as const;

// "Make me one" is the custom path's name wherever a shopper starts it; "work order" stays the name of the thing made
// (tickets, stamps, WO-numbers). Drops is off the bar while the newest pieces are the whole shop; /drops still works.
export const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/custom", label: "Make me one" },
  { href: "/track", label: "Track order" },
] as const;
