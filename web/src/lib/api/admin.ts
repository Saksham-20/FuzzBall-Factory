import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/admin";
import { ApiError, db, wait } from "@/lib/mock/db";
import { balanceAmount, ev, patchRequest } from "@/lib/api/custom";
import type { Category, Coupon, CustomRequest, Material, Order, OrderStatus, Product, Quote, Review, StoreSettings, User } from "@/lib/types";

function requireAdmin() {
  const d = db.get();
  const u = d.session && d.users.find((x) => x.id === d.session!.userId);
  if (!u || u.role !== "admin") throw new ApiError(403, "Admins only.");
  return u;
}

const sameDay = (a: string, b: Date) => new Date(a).toDateString() === b.toDateString();

/** Order stages that count as "in the workshop": being made or packed, not yet handed to a courier. */
const PRODUCTION_ORDER_STATUSES: OrderStatus[] = ["IN_PRODUCTION", "PACKED"];

/** The `at` of the earliest event matching `statuses`, or `createdAt` when there's no such event yet. */
function stageStart(events: { status: string; at: string }[], statuses: string[], createdAt: string): string {
  const matches = events.filter((e) => statuses.includes(e.status));
  return matches.length ? matches.reduce((min, e) => (e.at < min ? e.at : min), matches[0].at) : createdAt;
}

/** Honest one-line read of the workshop: real counts only, no invented urgency and no fake capacity percentage. */
function workshopSummary(ordersInProduction: number, customInProgress: number, oldestDays: number | null): string {
  const total = ordersInProduction + customInProgress;
  if (total === 0) return "Nothing in the workshop right now.";
  const pieces = `${total} piece${total === 1 ? "" : "s"} in progress`;
  if (oldestDays === null) return `${pieces}.`;
  if (oldestDays <= 0) return `${pieces}, oldest started today.`;
  return `${pieces}, oldest started ${oldestDays} day${oldestDays === 1 ? "" : "s"} ago.`;
}

export interface NeedsYou {
  kind: "cod" | "quote" | "counter" | "expiring" | "pack" | "approval-wait";
  label: string;
  href: string;
  at: string;
}

/** Aggregate load across both fulfilment streams, so a maker running ready-stock and made-to-order at once can see the queue at a glance. */
export interface WorkshopLoad {
  ordersInProduction: number;
  customInProgress: number;
  /** Days since the single oldest item now in production/progress started that stage; `null` when nothing is in progress. */
  oldestDays: number | null;
  summary: string;
}

export interface Dashboard {
  ordersToday: number;
  revenue: { today: number; d7: number; d30: number };
  pendingCod: number;
  toQuote: number;
  awaitingCustomer: number;
  inProgress: number;
  lowStock: Product[];
  needsYou: NeedsYou[];
  workshopLoad: WorkshopLoad;
  /** Paid order revenue per day, last 30 days, oldest first. */
  revenueByDay: { date: string; amount: number }[];
}

export async function dashboard(): Promise<Dashboard> {
  if (!SITE.useMock) return real.dashboard();
  await wait(300);
  requireAdmin();
  const d = db.get();
  const now = new Date();
  const paid = d.orders.filter((o) => o.paymentStatus === "PAID" || o.status === "DELIVERED");
  const since = (days: number) => paid.filter((o) => now.getTime() - new Date(o.createdAt).getTime() < days * 864e5).reduce((s, o) => s + o.total, 0);
  const revenueByDay = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(now);
    day.setDate(now.getDate() - (29 - i));
    return { date: day.toISOString(), amount: paid.filter((o) => sameDay(o.createdAt, day)).reduce((s, o) => s + o.total, 0) };
  });
  const needsYou: NeedsYou[] = [
    ...d.orders.filter((o) => o.paymentMethod === "COD" && o.status === "PLACED").map((o): NeedsYou => ({ kind: "cod", label: `Confirm COD order ${o.number} on WhatsApp`, href: `/admin/orders/${o.number}`, at: o.createdAt })),
    ...d.custom.filter((r) => r.status === "REQUESTED" || r.status === "UNDER_REVIEW").map((r): NeedsYou => ({ kind: "quote", label: `Quote ${r.number}: ${r.title}`, href: `/admin/custom/${r.number}`, at: r.createdAt })),
    ...d.custom.filter((r) => r.status === "COUNTERED").map((r): NeedsYou => ({ kind: "counter", label: `Answer counter on ${r.number}`, href: `/admin/custom/${r.number}`, at: r.createdAt })),
    ...d.custom.flatMap((r) => r.quotes.filter((q) => q.status === "SENT" && new Date(q.validUntil).getTime() - now.getTime() < 2 * 864e5).map((): NeedsYou => ({ kind: "expiring", label: `Quote on ${r.number} expires soon`, href: `/admin/custom/${r.number}`, at: r.createdAt }))),
    ...d.orders.filter((o) => ["CONFIRMED", "IN_PRODUCTION"].includes(o.status)).map((o): NeedsYou => ({ kind: "pack", label: `${o.number} is waiting to be made or packed`, href: `/admin/orders/${o.number}`, at: o.createdAt })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const ordersInProduction = d.orders.filter((o) => PRODUCTION_ORDER_STATUSES.includes(o.status));
  const customInProgress = d.custom.filter((r) => r.status === "IN_PROGRESS");
  const workshopStarts = [
    ...ordersInProduction.map((o) => stageStart(o.events, PRODUCTION_ORDER_STATUSES, o.createdAt)),
    ...customInProgress.map((r) => stageStart(r.events, ["IN_PROGRESS"], r.createdAt)),
  ];
  const oldestDays = workshopStarts.length ? Math.floor((now.getTime() - Math.min(...workshopStarts.map((s) => new Date(s).getTime()))) / 864e5) : null;
  const workshopLoad: WorkshopLoad = {
    ordersInProduction: ordersInProduction.length,
    customInProgress: customInProgress.length,
    oldestDays,
    summary: workshopSummary(ordersInProduction.length, customInProgress.length, oldestDays),
  };
  return {
    ordersToday: d.orders.filter((o) => sameDay(o.createdAt, now)).length,
    revenue: { today: since(1), d7: since(7), d30: since(30) },
    pendingCod: d.orders.filter((o) => o.paymentMethod === "COD" && o.status === "PLACED").length,
    toQuote: d.custom.filter((r) => ["REQUESTED", "UNDER_REVIEW", "COUNTERED"].includes(r.status)).length,
    awaitingCustomer: d.custom.filter((r) => r.status === "QUOTED").length,
    inProgress: d.custom.filter((r) => r.status === "IN_PROGRESS").length,
    lowStock: d.products.filter((p) => p.status === "PUBLISHED" && p.fulfilment === "READY" && p.variants.reduce((s, v) => s + v.stock, 0) <= 2),
    needsYou,
    workshopLoad,
    revenueByDay,
  };
}

/* ───────── Products & categories ───────── */

export async function listAdminProducts(q?: string): Promise<Product[]> {
  if (!SITE.useMock) return real.listAdminProducts(q);
  await wait(250);
  requireAdmin();
  const s = q?.toLowerCase();
  return db.get().products.filter((p) => !s || p.name.toLowerCase().includes(s) || String(p.batch).includes(s));
}

export async function getAdminProduct(id: string): Promise<Product> {
  if (!SITE.useMock) return real.getAdminProduct(id);
  await wait(200);
  requireAdmin();
  const p = db.get().products.find((x) => x.id === id);
  if (!p) throw new ApiError(404, "Product not found.");
  return p;
}

export async function saveProduct(input: Omit<Product, "id" | "batch" | "createdAt" | "slug"> & { id?: string; slug?: string }): Promise<Product> {
  if (!SITE.useMock) return real.saveProduct(input);
  await wait(500);
  requireAdmin();
  const d = db.get();
  const slug = (input.slug ?? input.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (d.products.some((p) => p.slug === slug && p.id !== input.id)) throw new ApiError(409, "Another product already uses that name/slug.", { name: "Already used" });
  if (input.id) {
    db.update((x) => ({ ...x, products: x.products.map((p) => (p.id === input.id ? { ...p, ...input, slug, sample: false } : p)) }));
    return db.get().products.find((p) => p.id === input.id)!;
  }
  const n = d.seq.product + 1;
  const p: Product = { ...input, id: `p${n}`, batch: n, slug, createdAt: new Date().toISOString(), sample: false };
  db.update((x) => ({ ...x, products: [p, ...x.products], seq: { ...x.seq, product: n } }));
  return p;
}

export async function setProductStatus(ids: string[], status: Product["status"]): Promise<void> {
  if (!SITE.useMock) return real.setProductStatus(ids, status);
  await wait(300);
  requireAdmin();
  db.update((x) => ({ ...x, products: x.products.map((p) => (ids.includes(p.id) ? { ...p, status } : p)) }));
}

export async function saveCategory(c: Category): Promise<Category> {
  if (!SITE.useMock) return real.saveCategory(c);
  await wait(300);
  requireAdmin();
  db.update((x) => ({ ...x, categories: x.categories.some((y) => y.slug === c.slug) ? x.categories.map((y) => (y.slug === c.slug ? c : y)) : [...x.categories, c] }));
  return c;
}
export async function deleteCategory(slug: string): Promise<void> {
  if (!SITE.useMock) return real.deleteCategory(slug);
  await wait(300);
  requireAdmin();
  if (db.get().products.some((p) => p.category === slug)) throw new ApiError(409, "Move or archive the products in this category first.");
  db.update((x) => ({ ...x, categories: x.categories.filter((c) => c.slug !== slug) }));
}

/* ───────── Orders ───────── */

export async function listAdminOrders(filter?: { status?: OrderStatus | "TO_CONFIRM" | "TO_MAKE" | "TO_PACK"; q?: string }): Promise<Order[]> {
  if (!SITE.useMock) return real.listAdminOrders(filter);
  await wait(250);
  requireAdmin();
  let list = [...db.get().orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const s = filter?.status;
  if (s === "TO_CONFIRM") list = list.filter((o) => o.paymentMethod === "COD" && o.status === "PLACED");
  else if (s === "TO_MAKE") list = list.filter((o) => ["CONFIRMED", "IN_PRODUCTION"].includes(o.status) && o.items.some((i) => i.fulfilment === "MADE_TO_ORDER"));
  else if (s === "TO_PACK") list = list.filter((o) => ["CONFIRMED", "IN_PRODUCTION"].includes(o.status));
  else if (s) list = list.filter((o) => o.status === s);
  if (filter?.q) {
    const q = filter.q.toLowerCase();
    list = list.filter((o) => o.number.toLowerCase().includes(q) || o.contact.name.toLowerCase().includes(q) || o.contact.phone.includes(q));
  }
  return list;
}

export async function getAdminOrder(number: string): Promise<Order> {
  if (!SITE.useMock) return real.getAdminOrder(number);
  await wait(200);
  requireAdmin();
  const o = db.get().orders.find((x) => x.number === number);
  if (!o) throw new ApiError(404, "Order not found.");
  return o;
}

const ORDER_NEXT: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ["CANCELLED"],
  PLACED: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["IN_PRODUCTION", "PACKED", "CANCELLED"],
  IN_PRODUCTION: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED"],
  CANCELLED: [],
  RETURN_REQUESTED: ["REFUNDED", "DELIVERED"],
  REFUNDED: [],
};
export const allowedNextStatuses = (s: OrderStatus) => ORDER_NEXT[s];

/** The one place order status changes. `SHIPPED` needs courier + AWB. */
export async function updateOrderStatus(number: string, status: OrderStatus, opts?: { note?: string; courier?: string; awb?: string }): Promise<Order> {
  if (!SITE.useMock) return real.updateOrderStatus(number, status, opts);
  await wait(400);
  requireAdmin();
  const o = db.get().orders.find((x) => x.number === number);
  if (!o) throw new ApiError(404, "Order not found.");
  if (!ORDER_NEXT[o.status].includes(status)) throw new ApiError(400, `Can't move an order from ${o.status} to ${status}.`);
  if (status === "SHIPPED" && (!opts?.courier || !opts?.awb)) throw new ApiError(400, "Add the courier and AWB number to ship.", { awb: "Required" });
  const at = new Date().toISOString();
  db.update((x) => ({
    ...x,
    orders: x.orders.map((y) =>
      y.number === number
        ? {
            ...y, status,
            courier: opts?.courier ?? y.courier, awb: opts?.awb ?? y.awb,
            paymentStatus: status === "REFUNDED" || (status === "CANCELLED" && y.paymentStatus === "PAID") ? "REFUNDED" : status === "DELIVERED" && y.paymentMethod === "COD" ? "PAID" : y.paymentStatus,
            events: [...y.events, { status, at, note: opts?.note ?? (status === "SHIPPED" ? `Handed to ${opts?.courier}. AWB ${opts?.awb}.` : undefined) }],
          }
        : y,
    ),
  }));
  return db.get().orders.find((x) => x.number === number)!;
}

/* ───────── Custom work orders ───────── */

export async function listAdminCustom(status?: string): Promise<CustomRequest[]> {
  if (!SITE.useMock) return real.listAdminCustom(status);
  await wait(250);
  requireAdmin();
  return db.get().custom.filter((r) => !status || r.status === status).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getAdminCustom(number: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.getAdminCustom(number);
  await wait(200);
  requireAdmin();
  const r = db.get().custom.find((x) => x.number === number);
  if (!r) throw new ApiError(404, "Work order not found.");
  return r;
}

export interface QuoteInput {
  breakdown: { label: string; amount: number }[];
  timelineDays: number;
  revisions: number;
  scope: string;
  validDays?: number;
}

/** Sends (or re-sends after a counter) a quote. Deposit % and validity default from settings. */
export async function sendQuote(number: string, input: QuoteInput): Promise<CustomRequest> {
  if (!SITE.useMock) return real.sendQuote(number, input);
  await wait(500);
  requireAdmin();
  const d = db.get();
  const r = d.custom.find((x) => x.number === number);
  if (!r) throw new ApiError(404, "Work order not found.");
  if (!["REQUESTED", "UNDER_REVIEW", "COUNTERED", "EXPIRED"].includes(r.status)) throw new ApiError(400, "This work order can't be quoted right now.");
  const price = input.breakdown.reduce((s, l) => s + l.amount, 0);
  if (price <= 0) throw new ApiError(400, "Add at least one priced line.");
  const valid = new Date();
  valid.setDate(valid.getDate() + (input.validDays ?? d.settings.quoteValidityDays));
  const q: Quote = {
    id: `q${Date.now()}`, price, depositPct: d.settings.depositPct, breakdown: input.breakdown, timelineDays: input.timelineDays,
    revisions: input.revisions, scope: input.scope, validUntil: valid.toISOString(), status: "SENT", createdAt: new Date().toISOString(),
  };
  patchRequest(number, (x) => ({ ...x, status: "QUOTED", quotes: [...x.quotes.map((y) => (y.status === "COUNTERED" || y.status === "SENT" ? { ...y, status: "DECLINED" as const } : y)), q] }), ev("QUOTED", `Quote sent: ₹${price.toLocaleString("en-IN")}.`));
  return db.get().custom.find((x) => x.number === number)!;
}

export async function declineCustom(number: string, reason: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.declineCustom(number, reason);
  await wait(400);
  requireAdmin();
  patchRequest(number, (x) => ({ ...x, status: "DECLINED", messages: [...x.messages, { id: `m${Date.now()}`, author: "maker", body: reason, at: new Date().toISOString() }] }), ev("DECLINED", reason));
  return db.get().custom.find((x) => x.number === number)!;
}

/** Accept the customer's counter (price becomes the counter, deposit due) or re-quote instead via sendQuote. */
export async function acceptCounter(number: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.acceptCounter(number);
  await wait(500);
  requireAdmin();
  const r = db.get().custom.find((x) => x.number === number);
  const q = r?.quotes.find((x) => x.status === "COUNTERED" && x.counter);
  if (!r || !q?.counter) throw new ApiError(400, "There's no counter-offer to accept.");
  const scale = q.counter.amount / q.price;
  patchRequest(number, (x) => ({
    ...x, status: "DEPOSIT_PENDING",
    quotes: x.quotes.map((y) => (y.id === q.id ? { ...y, status: "ACCEPTED", price: q.counter!.amount, breakdown: y.breakdown.map((l) => ({ ...l, amount: Math.round(l.amount * scale) })) } : y)),
  }), ev("ACCEPTED", `Counter-offer accepted: ₹${q.counter.amount.toLocaleString("en-IN")}. Deposit due.`));
  return db.get().custom.find((x) => x.number === number)!;
}

export async function markUnderReview(number: string): Promise<void> {
  if (!SITE.useMock) return real.markUnderReview(number);
  await wait(200);
  requireAdmin();
  patchRequest(number, (x) => (x.status === "REQUESTED" ? { ...x, status: "UNDER_REVIEW" } : x), ev("UNDER_REVIEW", "Looking at your idea."));
}

export async function adminMessage(number: string, body: string, attachments?: string[]): Promise<CustomRequest> {
  if (!SITE.useMock) return real.adminMessage(number, body, attachments);
  await wait(300);
  requireAdmin();
  patchRequest(number, (x) => ({ ...x, messages: [...x.messages, { id: `m${Date.now()}`, author: "maker", body, attachments, at: new Date().toISOString() }] }));
  return db.get().custom.find((x) => x.number === number)!;
}

export async function addProgress(number: string, note: string, photo?: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.addProgress(number, note, photo);
  await wait(400);
  requireAdmin();
  patchRequest(number, (x) => ({ ...x, status: x.status === "IN_QUEUE" || x.status === "DEPOSIT_PENDING" ? "IN_PROGRESS" : x.status }), ev("IN_PROGRESS", note, photo));
  return db.get().custom.find((x) => x.number === number)!;
}

export async function requestApproval(number: string, note?: string, photo?: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.requestApproval(number, note, photo);
  await wait(400);
  requireAdmin();
  patchRequest(number, (x) => ({ ...x, status: "AWAITING_APPROVAL" }), ev("AWAITING_APPROVAL", note ?? "Your finished piece is ready for approval.", photo));
  return db.get().custom.find((x) => x.number === number)!;
}

export async function markCustomShipped(number: string, courier: string, awb: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.markCustomShipped(number, courier, awb);
  await wait(400);
  requireAdmin();
  if (!courier || !awb) throw new ApiError(400, "Add the courier and AWB number.", { awb: "Required" });
  const r = db.get().custom.find((x) => x.number === number);
  if (r?.status !== "READY_TO_SHIP") throw new ApiError(400, "Ship after the balance is paid.");
  patchRequest(number, (x) => ({ ...x, status: "SHIPPED" }), ev("SHIPPED", `Handed to ${courier}. AWB ${awb}.`));
  return db.get().custom.find((x) => x.number === number)!;
}

export async function markCustomDelivered(number: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.markCustomDelivered(number);
  await wait(300);
  requireAdmin();
  patchRequest(number, (x) => ({ ...x, status: "DELIVERED" }), ev("DELIVERED", "Delivered."));
  return db.get().custom.find((x) => x.number === number)!;
}

export const balanceDue = (r: CustomRequest) => {
  const q = r.quotes.find((x) => x.status === "ACCEPTED");
  return q ? balanceAmount(q) : 0;
};

/* ───────── Customers, reviews, coupons, settings ───────── */

export interface CustomerRow extends User {
  orders: number;
  workOrders: number;
  spent: number;
}

export async function listCustomers(q?: string): Promise<CustomerRow[]> {
  if (!SITE.useMock) return real.listCustomers(q);
  await wait(250);
  requireAdmin();
  const d = db.get();
  const s = q?.toLowerCase();
  return d.users
    .filter((u) => u.role === "customer" && (!s || u.name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s)))
    .map(({ password, ...u }) => {
      void password;
      const os = d.orders.filter((o) => o.userId === u.id);
      return { ...u, orders: os.length, workOrders: d.custom.filter((r) => r.userId === u.id).length, spent: os.filter((o) => o.paymentStatus === "PAID").reduce((t, o) => t + o.total, 0) };
    });
}

export async function getCustomer(id: string) {
  if (!SITE.useMock) return real.getCustomer(id);
  await wait(200);
  requireAdmin();
  const d = db.get();
  const u = d.users.find((x) => x.id === id);
  if (!u) throw new ApiError(404, "Customer not found.");
  const { password, ...user } = u;
  void password;
  return { user, orders: d.orders.filter((o) => o.userId === id), custom: d.custom.filter((r) => r.userId === id) };
}

export async function listAdminReviews(status?: Review["status"]): Promise<Review[]> {
  if (!SITE.useMock) return real.listAdminReviews(status);
  await wait(200);
  requireAdmin();
  return db.get().reviews.filter((r) => !status || r.status === status);
}
/** `disputeReason` is required (and only stored) when moving a review to DISPUTED; it is kept for the record if the review is later published/hidden again. */
export async function moderateReview(id: string, status: Review["status"], disputeReason?: string): Promise<void> {
  if (!SITE.useMock) return real.moderateReview(id, status, disputeReason);
  await wait(250);
  requireAdmin();
  const reason = disputeReason?.trim();
  if (status === "DISPUTED" && !reason) throw new ApiError(400, "Add a short reason for the dispute.", { disputeReason: "Required" });
  db.update((x) => ({
    ...x,
    reviews: x.reviews.map((r) => (r.id === id ? { ...r, status, ...(status === "DISPUTED" ? { disputeReason: reason } : {}) } : r)),
  }));
}

/** Sets (or replaces) the maker's public reply on a review. Shown on the product page, labelled as the maker's reply. */
export async function setReviewReply(id: string, reply: string): Promise<void> {
  if (!SITE.useMock) return real.setReviewReply(id, reply);
  await wait(250);
  requireAdmin();
  const body = reply.trim();
  if (!body) throw new ApiError(400, "Write a reply before saving.", { reply: "Required" });
  db.update((x) => ({ ...x, reviews: x.reviews.map((r) => (r.id === id ? { ...r, reply: body, repliedAt: new Date().toISOString() } : r)) }));
}

/** Removes the maker's reply from a review. */
export async function clearReviewReply(id: string): Promise<void> {
  if (!SITE.useMock) return real.clearReviewReply(id);
  await wait(200);
  requireAdmin();
  db.update((x) => ({
    ...x,
    reviews: x.reviews.map((r) => (r.id === id ? { ...r, reply: undefined, repliedAt: undefined } : r)),
  }));
}

export async function listCoupons(): Promise<Coupon[]> {
  if (!SITE.useMock) return real.listCoupons();
  await wait(200);
  requireAdmin();
  return db.get().coupons;
}
export async function saveCoupon(c: Coupon): Promise<Coupon> {
  if (!SITE.useMock) return real.saveCoupon(c);
  await wait(300);
  requireAdmin();
  const code = c.code.trim().toUpperCase();
  db.update((x) => ({ ...x, coupons: x.coupons.some((y) => y.code === code) ? x.coupons.map((y) => (y.code === code ? { ...c, code } : y)) : [...x.coupons, { ...c, code }] }));
  return { ...c, code };
}
export async function deleteCoupon(code: string): Promise<void> {
  if (!SITE.useMock) return real.deleteCoupon(code);
  await wait(250);
  requireAdmin();
  db.update((x) => ({ ...x, coupons: x.coupons.filter((c) => c.code !== code) }));
}

/* ───────── Materials (inventory) ───────── */

/** Non-archived materials only (the picker in the price calculator and this list both want only what's still stocked). */
export async function listMaterials(): Promise<Material[]> {
  if (!SITE.useMock) return real.listMaterials();
  await wait(200);
  requireAdmin();
  return db.get().materials.filter((m) => !m.archived);
}

export async function saveMaterial(input: Omit<Material, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Material> {
  if (!SITE.useMock) return real.saveMaterial(input);
  await wait(350);
  requireAdmin();
  const now = new Date().toISOString();
  if (input.id) {
    const id = input.id;
    db.update((x) => ({ ...x, materials: x.materials.map((m) => (m.id === id ? { ...m, ...input, id, updatedAt: now } : m)) }));
    const updated = db.get().materials.find((m) => m.id === id);
    if (!updated) throw new ApiError(404, "Material not found.");
    return updated;
  }
  const d = db.get();
  const n = d.seq.material + 1;
  const material: Material = { ...input, id: `mat${n}`, archived: input.archived ?? false, createdAt: now, updatedAt: now };
  db.update((x) => ({ ...x, materials: [material, ...x.materials], seq: { ...x.seq, material: n } }));
  return material;
}

/** Soft delete: hides it from the list and the price calculator's picker; past usage isn't affected. */
export async function archiveMaterial(id: string): Promise<void> {
  if (!SITE.useMock) return real.archiveMaterial(id);
  await wait(300);
  requireAdmin();
  const m = db.get().materials.find((x) => x.id === id);
  if (!m) throw new ApiError(404, "Material not found.");
  db.update((x) => ({ ...x, materials: x.materials.map((y) => (y.id === id ? { ...y, archived: true, updatedAt: new Date().toISOString() } : y)) }));
}

/** Changes `qtyOnHand` by `delta` (negative to record material used on a piece). Returns the updated material. */
export async function adjustMaterialStock(id: string, delta: number, reason?: string): Promise<Material> {
  if (!SITE.useMock) return real.adjustMaterialStock(id, delta, reason);
  await wait(300);
  requireAdmin();
  void reason; // the mock has nowhere to log a reason; the real API keeps it on the AuditLog row
  const m = db.get().materials.find((x) => x.id === id);
  if (!m) throw new ApiError(404, "Material not found.");
  const qtyOnHand = Math.round((m.qtyOnHand + delta) * 1000) / 1000;
  db.update((x) => ({ ...x, materials: x.materials.map((y) => (y.id === id ? { ...y, qtyOnHand, updatedAt: new Date().toISOString() } : y)) }));
  return db.get().materials.find((x) => x.id === id)!;
}

/** Settings for the admin form. Real API: GET /admin/settings, because the public GET /settings is browser-cached for 30s and would show stale values after a save. */
export async function getAdminSettings(): Promise<StoreSettings> {
  if (!SITE.useMock) return real.getAdminSettings();
  await wait(80);
  requireAdmin();
  return db.get().settings;
}

export async function updateSettings(s: StoreSettings): Promise<StoreSettings> {
  if (!SITE.useMock) return real.updateSettings(s);
  await wait(400);
  requireAdmin();
  db.update((x) => ({ ...x, settings: s }));
  return s;
}
