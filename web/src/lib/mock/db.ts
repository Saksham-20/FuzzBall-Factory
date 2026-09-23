import { createPersistedStore } from "@/lib/store";
import { ApiError } from "@/lib/api/errors";
import { products as seedProducts, categories as seedCategories } from "@/lib/mock/catalog";
import type {
  Address, Category, Coupon, CustomRequest, Material, Order, Product, Review, StoreSettings, User,
} from "@/lib/types";

/*
 * PLACEHOLDER(catalogue): all users, orders, work orders and coupons below are SAMPLE data.
 * The mock DB lives in localStorage ("fbf-mock-v1") so admin changes show up in the customer
 * account in the same browser. Real data comes from the NestJS API in Phase 2.
 */

export type MockUser = User & { password: string };

export interface DB {
  users: MockUser[];
  session: { userId: string } | null;
  addresses: Address[]; // owned by user via `userId`
  addressOwner: Record<string, string>;
  products: Product[];
  categories: Category[];
  orders: Order[];
  custom: CustomRequest[];
  coupons: Coupon[];
  reviews: Review[];
  materials: Material[];
  settings: StoreSettings;
  seq: { order: number; wo: number; product: number; material: number };
}

const iso = (daysAgo: number, hour = 11) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const ahead = (days: number) => iso(-days);

export const MOCK_PASSWORD = "fuzzball123";

const settings: StoreSettings = {
  whatsapp: "910000000000",
  email: "hello@fuzzballfactory.example",
  freeShippingAbove: 999,
  domesticShipping: 79,
  codEnabled: true,
  codCap: 2000,
  codFee: 49,
  giftWrapPrice: 59,
  depositPct: 50,
  quoteValidityDays: 7,
  intlZones: [
    { name: "South Asia & Middle East", countries: ["NP", "LK", "BD", "AE", "SA", "QA"], rate: 899, days: "7–12 days" },
    { name: "UK & Europe", countries: ["GB", "DE", "FR", "NL", "IT", "ES", "IE"], rate: 1499, days: "8–14 days" },
    { name: "USA, Canada & Australia", countries: ["US", "CA", "AU", "NZ", "SG", "MY"], rate: 1799, days: "10–16 days" },
    { name: "Rest of world", countries: ["*", "OTHER"], rate: 1999, days: "12–20 days" },
  ],
};

const maya: MockUser = { id: "u1", name: "Maya Iyer", email: "maya@example.com", phone: "+919800000001", role: "customer", createdAt: iso(60), password: MOCK_PASSWORD };
const admin: MockUser = { id: "u0", name: "Factory Admin", email: "admin@fuzzball.test", phone: "+910000000000", role: "admin", createdAt: iso(120), password: MOCK_PASSWORD };
const arjun: MockUser = { id: "u2", name: "Arjun Nair", email: "arjun@example.com", phone: "+919800000002", role: "customer", createdAt: iso(30), password: MOCK_PASSWORD };
const sophie: MockUser = { id: "u3", name: "Sophie Clarke", email: "sophie@example.com", phone: "+447700900123", role: "customer", createdAt: iso(14), password: MOCK_PASSWORD };

const addrIN: Address = { id: "a1", label: "Home", name: "Maya Iyer", phone: "+919800000001", line1: "12, Lotus Apartments, 4th Cross", line2: "Indiranagar", city: "Bengaluru", state: "Karnataka", postalCode: "560038", country: "IN", isDefault: true };
const addrUK: Address = { id: "a2", label: "Sister in London", name: "Anu Iyer", phone: "+447700900456", line1: "5 Rosebery Road", city: "London", state: "England", postalCode: "N10 2LE", country: "GB" };

const p = (id: string) => seedProducts.find((x) => x.id === id)!;
const line = (id: string, qty = 1, colour?: string, size?: string, personalization?: string) => {
  const pr = p(id);
  const v = pr.variants.find((x) => (!colour || x.colour === colour) && (!size || x.size === size)) ?? pr.variants[0];
  return { productId: pr.id, name: pr.name, image: pr.images[0].src, colour: v.colour, size: v.size, qty, unitPrice: pr.price, fulfilment: pr.fulfilment, personalization };
};
const addr = (a: Address) => ({ name: a.name, phone: a.phone, line1: a.line1, line2: a.line2, city: a.city, state: a.state, postalCode: a.postalCode, country: a.country });

function order(n: number, o: Partial<Order> & Pick<Order, "items" | "status" | "paymentMethod" | "paymentStatus">, daysAgo: number): Order {
  const subtotal = o.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
  const shipping = subtotal >= 999 ? 0 : 79;
  const codFee = o.paymentMethod === "COD" ? 49 : 0;
  return {
    number: `FB-${1000 + n}`,
    userId: "u1",
    contact: { name: maya.name, email: maya.email, phone: maya.phone! },
    address: addr(addrIN),
    subtotal, shipping, codFee, giftWrap: 0, discount: 0,
    total: subtotal + shipping + codFee,
    currency: "INR",
    estimatedDispatch: ahead(2 - daysAgo),
    events: [],
    createdAt: iso(daysAgo),
    ...o,
  };
}

const orders: Order[] = [
  order(23, {
    items: [line("p4", 1), line("p10", 1)], status: "PLACED", paymentMethod: "COD", paymentStatus: "COD_DUE",
    events: [{ status: "PLACED", at: iso(0, 9), note: "Order placed. We'll confirm on WhatsApp before dispatch." }],
  }, 0),
  order(22, {
    items: [line("p1", 1, "Cherry")], status: "IN_PRODUCTION", paymentMethod: "RAZORPAY", paymentStatus: "PAID",
    giftNote: "Happy birthday, Meera! Love, Maya", giftWrap: 59, total: 1450 + 59,
    events: [
      { status: "PLACED", at: iso(3, 10) },
      { status: "CONFIRMED", at: iso(3, 11), note: "Payment received." },
      { status: "IN_PRODUCTION", at: iso(2, 10), note: "Rosie's sweater is on the hook." },
    ],
  }, 3),
  order(21, {
    items: [line("p3", 1)], status: "SHIPPED", paymentMethod: "RAZORPAY", paymentStatus: "PAID", courier: "Delhivery", awb: "DL7845123001",
    events: [
      { status: "PLACED", at: iso(9) }, { status: "CONFIRMED", at: iso(9, 12) },
      { status: "IN_PRODUCTION", at: iso(8) }, { status: "PACKED", at: iso(4) },
      { status: "SHIPPED", at: iso(3), note: "Handed to Delhivery. AWB DL7845123001." },
    ],
  }, 9),
  order(20, {
    items: [line("p2", 2), line("p5", 1)], status: "DELIVERED", paymentMethod: "RAZORPAY", paymentStatus: "PAID", courier: "India Post", awb: "EE123456789IN",
    events: [
      { status: "PLACED", at: iso(20) }, { status: "CONFIRMED", at: iso(20, 12) }, { status: "PACKED", at: iso(18) },
      { status: "SHIPPED", at: iso(17) }, { status: "DELIVERED", at: iso(13), note: "Delivered." },
    ],
  }, 20),
  order(19, {
    items: [line("p15", 1)], status: "CANCELLED", paymentMethod: "COD", paymentStatus: "FAILED",
    events: [{ status: "PLACED", at: iso(30) }, { status: "CANCELLED", at: iso(29), note: "Cancelled at the customer's request." }],
  }, 30),
  order(18, {
    userId: "u3", contact: { name: sophie.name, email: sophie.email, phone: sophie.phone! }, address: addr(addrUK),
    items: [line("p8", 1, "Navy", "M")], status: "CONFIRMED", paymentMethod: "RAZORPAY", paymentStatus: "PAID",
    subtotal: 1199, shipping: 1499, total: 2698, events: [{ status: "PLACED", at: iso(1) }, { status: "CONFIRMED", at: iso(1, 12) }],
  }, 1),
];

const q = (id: string, price: number, over: Partial<CustomRequest["quotes"][number]> = {}) => ({
  id, price, depositPct: 50,
  breakdown: [
    { label: "Materials (yarn, stuffing, eyes)", amount: Math.round(price * 0.3) },
    { label: "Crochet time (approx. 9 hrs)", amount: Math.round(price * 0.6) },
    { label: "Design & packaging", amount: price - Math.round(price * 0.3) - Math.round(price * 0.6) },
  ],
  timelineDays: 8, revisions: 1,
  scope: "One piece as described. One round of changes to colour or small details before the final photos. Extra changes are quoted separately.",
  validUntil: ahead(5), status: "SENT" as const, createdAt: iso(1), ...over,
});

const wo = (n: number, over: Partial<CustomRequest> & Pick<CustomRequest, "title" | "description" | "status">, daysAgo: number): CustomRequest => ({
  number: `WO-${String(n).padStart(3, "0")}`,
  userId: "u1", customerName: maya.name, customerPhone: maya.phone!,
  kind: "NEW", category: "plushies", colours: ["Cream", "Navy"], size: "About 15 cm tall", quantity: 1,
  budgetMin: 1500, budgetMax: 2200, references: ["/samples/bear.jpg"], country: "IN", postalCode: "560038",
  quotes: [], messages: [], events: [], createdAt: iso(daysAgo), ...over,
});

const custom: CustomRequest[] = [
  wo(30, {
    title: "Panda with a tiny backpack", description: "A small black-and-white panda with a green backpack, about 12 cm. A gift for my niece's 5th birthday.",
    status: "REQUESTED", category: "plushies", colours: ["Black", "Cream", "Sage"], budgetMin: 900, budgetMax: 1400, occasion: "Birthday", neededBy: ahead(24),
    references: [], events: [{ status: "REQUESTED", at: iso(0, 8), note: "Work order sent." }],
  }, 0),
  wo(29, {
    title: "Graduation bear", description: "A small crochet bear in a graduation cap. Cream and navy, about 15 cm. For my sister's graduation.",
    status: "QUOTED", occasion: "Graduation", neededBy: ahead(22), personalization: "Priya, Class of 2026",
    quotes: [q("q29a", 1850)],
    messages: [
      { id: "m1", author: "customer", body: "Could the cap have a little gold tassel?", at: iso(2, 15) },
      { id: "m2", author: "maker", body: "Yes, easy to add. I've included it in the quote. Have a look and let me know!", at: iso(1, 10) },
    ],
    events: [{ status: "REQUESTED", at: iso(3) }, { status: "QUOTED", at: iso(1), note: "Quote sent: ₹1,850." }],
  }, 3),
  wo(27, {
    title: "Wildflower bouquet, pastel", description: "Pastel version of your wildflower bouquet, 9 stems. Wrapped in kraft paper.",
    status: "COUNTERED", kind: "CUSTOMIZE", baseProductSlug: "wildflower-bouquet", category: "bouquets", colours: ["Lilac", "Cream", "Peach"], size: "9 stems", budgetMin: 1500, budgetMax: 2000,
    quotes: [q("q27a", 2400, { status: "COUNTERED", counter: { amount: 2000, note: "Could we do 7 stems for ₹2,000?", at: iso(1, 16) } })],
    events: [{ status: "REQUESTED", at: iso(6) }, { status: "QUOTED", at: iso(4) }, { status: "COUNTERED", at: iso(1, 16), note: "Counter-offer sent: ₹2,000." }],
  }, 6),
  wo(24, {
    title: "Cat plushie that looks like Biscuit", description: "A chubby orange tabby, about 20 cm, with a white belly. Photos of Biscuit attached.",
    status: "DEPOSIT_PENDING", category: "plushies", colours: ["Marigold", "Cream"], size: "About 20 cm", budgetMin: 2000, budgetMax: 3000, references: ["/samples/kitty.jpg", "/samples/cat.jpg"],
    quotes: [q("q24a", 2600, { status: "ACCEPTED" })],
    events: [{ status: "REQUESTED", at: iso(8) }, { status: "QUOTED", at: iso(6) }, { status: "ACCEPTED", at: iso(1, 9), note: "Quote accepted: ₹2,600. Deposit of ₹1,300 to start." }],
  }, 8),
  wo(21, {
    title: "Two matching penguin keychains", description: "Two penguins in different scarves, for me and my best friend.",
    status: "IN_PROGRESS", category: "keychains", quantity: 2, size: "7 cm each", colours: ["Black", "Cream", "Rose"], budgetMin: 700, budgetMax: 1000, references: ["/samples/penguin.jpg"],
    quotes: [q("q21a", 850, { status: "ACCEPTED", timelineDays: 6 })],
    messages: [{ id: "m3", author: "maker", body: "The first penguin is done! Scarf number two tomorrow.", attachments: ["/samples/penguin.jpg"], at: iso(1, 14) }],
    events: [
      { status: "REQUESTED", at: iso(12) }, { status: "QUOTED", at: iso(11) }, { status: "ACCEPTED", at: iso(10) },
      { status: "IN_PROGRESS", at: iso(4), note: "Deposit received. Starting today." },
      { status: "IN_PROGRESS", at: iso(1, 14), note: "Progress photo: penguin one is done.", photo: "/samples/penguin.jpg" },
      { status: "IN_PROGRESS", at: iso(0, 10), note: "Progress photo: scarves in the works.", photo: "/samples/keychain.jpg" },
    ],
  }, 12),
  wo(18, {
    title: "Pikachu plushie", description: "A Pikachu, about 25 cm.", status: "DECLINED", category: "plushies", colours: ["Yellow"], budgetMin: 1500, budgetMax: 2500, references: [],
    messages: [{ id: "m4", author: "maker", body: "Thank you for asking! I can't make licensed characters. I'd love to make an original yellow mouse instead.", at: iso(14) }],
    events: [{ status: "REQUESTED", at: iso(15) }, { status: "DECLINED", at: iso(14), note: "Licensed character. We only make original designs." }],
  }, 15),
];

const coupons: Coupon[] = [
  { code: "FIRSTFUZZ", kind: "PERCENT", value: 10, minCart: 0, active: true, uses: 12 },
  { code: "GIFT100", kind: "FLAT", value: 100, minCart: 999, active: true, uses: 4 },
  { code: "EXPIRED20", kind: "PERCENT", value: 20, minCart: 0, active: false, uses: 30, expiresAt: iso(20) },
];

// PLACEHOLDER(materials-catalogue): sample inventory rows, not the maker's real stock or prices.
const materials: Material[] = [
  { id: "mat1", name: "Cotton yarn, cream, 100g skein", unit: "skein", costPerUnit: 180, qtyOnHand: 12, lowStockAt: 3, archived: false, sample: true, createdAt: iso(90), updatedAt: iso(5) },
  { id: "mat2", name: "Chenille velvet yarn, dusty rose, 100g skein", unit: "skein", costPerUnit: 260, qtyOnHand: 2, lowStockAt: 3, archived: false, sample: true, createdAt: iso(60), updatedAt: iso(2) },
  { id: "mat3", name: "Safety eyes, 12mm black (pair)", unit: "pair", costPerUnit: 8, qtyOnHand: 150, lowStockAt: 30, archived: false, sample: true, createdAt: iso(90), updatedAt: iso(10) },
  { id: "mat4", name: "Poly-fil stuffing, 500g bag", unit: "bag", costPerUnit: 220, qtyOnHand: 1, lowStockAt: 2, notes: "Reorder from the usual craft supplier once low.", archived: false, sample: true, createdAt: iso(90), updatedAt: iso(1) },
];

export function seedDb(): DB {
  return {
    users: [admin, maya, arjun, sophie],
    session: null,
    addresses: [addrIN, addrUK],
    addressOwner: { a1: "u1", a2: "u1" },
    products: seedProducts,
    categories: seedCategories,
    orders,
    custom,
    coupons,
    reviews: [], // no reviews seeded: the UI must show an honest empty state
    materials,
    settings,
    seq: { order: 1023, wo: 30, product: 15, material: materials.length },
  };
}

export const dbStore = createPersistedStore<DB>("fbf-mock-v1", seedDb());

export const db = {
  get: () => dbStore.getSnapshot(),
  update(fn: (d: DB) => DB) {
    dbStore.set((cur) => fn(structuredClone(cur)));
  },
  reset() {
    dbStore.set(seedDb());
  },
};

/** Simulated network latency so loading states are real. */
export const wait = (ms = 350) => new Promise<void>((r) => setTimeout(r, ms + Math.random() * 200));

export { ApiError };
export const iso_ = iso;
