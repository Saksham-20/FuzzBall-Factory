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
  // PLACEHOLDER(instagram): the maker's real profile URL
  instagram: "https://www.instagram.com/",
  useMock: process.env.NEXT_PUBLIC_USE_MOCK !== "false",
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

export const NAV = [
  { href: "/shop", label: "Shop" },
  { href: "/custom", label: "Work orders" },
  { href: "/drops", label: "Drops" },
  { href: "/track", label: "Track order" },
] as const;

export const STATIONS = [
  { id: "yarn-room", n: "01", name: "Yarn Room" },
  { id: "hook-floor", n: "02", name: "Hook Floor" },
  { id: "shelf", n: "03", name: "The Shelf" },
  { id: "work-orders", n: "04", name: "Work Orders" },
  { id: "shipping-dock", n: "05", name: "Shipping Dock" },
] as const;
