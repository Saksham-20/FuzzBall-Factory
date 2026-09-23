import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/custom";
import { ApiError, db, wait } from "@/lib/mock/db";
import type { CustomRequest, CustomStatus, Quote, TimelineEvent } from "@/lib/types";

export const MAX_COUNTERS = 2;

export const depositAmount = (q: Pick<Quote, "price" | "depositPct">) => Math.round((q.price * q.depositPct) / 100);
export const balanceAmount = (q: Pick<Quote, "price" | "depositPct">) => q.price - depositAmount(q);

/** The quote the customer should act on, if any (latest that isn't ended). */
export const liveQuote = (r: CustomRequest): Quote | undefined => [...r.quotes].reverse().find((q) => q.status === "SENT" || q.status === "COUNTERED" || q.status === "ACCEPTED");
export const countersUsed = (r: CustomRequest) => r.events.filter((e) => e.status === "COUNTERED").length;
export const quoteExpired = (q: Quote) => q.status === "SENT" && new Date(q.validUntil) < new Date();

function session() {
  const s = db.get().session;
  if (!s) throw new ApiError(401, "Please log in to manage your work orders.");
  return s;
}

function mineOrThrow(number: string): CustomRequest {
  const s = session();
  const d = db.get();
  const r = d.custom.find((x) => x.number === number);
  const admin = d.users.find((u) => u.id === s.userId)?.role === "admin";
  if (!r || (r.userId !== s.userId && !admin)) throw new ApiError(404, "We couldn't find that work order.");
  return r;
}

/** Applies a mutation + timeline event to one request. Shared by customer and admin flows. */
export function patchRequest(number: string, fn: (r: CustomRequest) => CustomRequest, event?: TimelineEvent) {
  db.update((d) => ({
    ...d,
    custom: d.custom.map((r) => {
      if (r.number !== number) return r;
      const next = fn(r);
      return event ? { ...next, events: [...next.events, event] } : next;
    }),
  }));
}
export const ev = (status: string, note?: string, photo?: string): TimelineEvent => ({ status, at: new Date().toISOString(), note, photo });

export interface CreateCustomInput {
  kind: "NEW" | "CUSTOMIZE";
  baseProductSlug?: string;
  category: string;
  title: string;
  description: string;
  colours: string[];
  size: string;
  quantity: number;
  budgetMin: number;
  budgetMax: number;
  neededBy?: string;
  occasion?: string;
  personalization?: string;
  references: string[];
  country: string;
  postalCode: string;
  phone: string;
}

export async function createRequest(input: CreateCustomInput): Promise<CustomRequest> {
  if (!SITE.useMock) return real.createRequest(input);
  await wait(600);
  const s = session();
  const d = db.get();
  const u = d.users.find((x) => x.id === s.userId)!;
  const r: CustomRequest = {
    ...input,
    number: `WO-${String(d.seq.wo + 1).padStart(3, "0")}`,
    userId: u.id,
    customerName: u.name,
    customerPhone: input.phone,
    status: "REQUESTED",
    quotes: [],
    messages: [],
    events: [ev("REQUESTED", "Work order sent.")],
    createdAt: new Date().toISOString(),
  };
  db.update((x) => ({ ...x, custom: [r, ...x.custom], seq: { ...x.seq, wo: x.seq.wo + 1 } }));
  return r;
}

export async function listMine(): Promise<CustomRequest[]> {
  if (!SITE.useMock) return real.listMine();
  await wait(250);
  const s = session();
  return db.get().custom.filter((r) => r.userId === s.userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMine(number: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.getMine(number);
  await wait(200);
  return mineOrThrow(number);
}

export async function addMessage(number: string, body: string, attachments?: string[]): Promise<CustomRequest> {
  if (!SITE.useMock) return real.addMessage(number, body, attachments);
  await wait(300);
  mineOrThrow(number);
  patchRequest(number, (r) => ({ ...r, messages: [...r.messages, { id: `m${Date.now()}`, author: "customer", body, attachments, at: new Date().toISOString() }] }));
  return mineOrThrow(number);
}

function requireStatus(r: CustomRequest, ...ok: CustomStatus[]) {
  if (!ok.includes(r.status)) throw new ApiError(400, "That isn't possible at this stage of the work order.");
}

/** Accept the live quote → deposit becomes due. */
export async function acceptQuote(number: string, quoteId: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.acceptQuote(number, quoteId);
  await wait(500);
  const r = mineOrThrow(number);
  requireStatus(r, "QUOTED");
  const q = r.quotes.find((x) => x.id === quoteId);
  if (!q || q.status !== "SENT") throw new ApiError(400, "That quote isn't open any more.");
  if (quoteExpired(q)) {
    patchRequest(number, (x) => ({ ...x, status: "EXPIRED", quotes: x.quotes.map((y) => (y.id === quoteId ? { ...y, status: "EXPIRED" } : y)) }), ev("EXPIRED", "The quote expired."));
    throw new ApiError(410, "This quote has expired. Message us to reopen it.");
  }
  patchRequest(number, (x) => ({ ...x, status: "DEPOSIT_PENDING", quotes: x.quotes.map((y) => (y.id === quoteId ? { ...y, status: "ACCEPTED" } : y)) }), ev("ACCEPTED", `Quote accepted. Deposit of ₹${depositAmount(q).toLocaleString("en-IN")} to start.`));
  return mineOrThrow(number);
}

/** Mock payment of the deposit (real flow: Razorpay Payment Link + webhook). */
export async function payDeposit(number: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.payDeposit(number);
  await wait(800);
  const r = mineOrThrow(number);
  requireStatus(r, "DEPOSIT_PENDING");
  patchRequest(number, (x) => ({ ...x, status: "IN_PROGRESS" }), ev("IN_PROGRESS", "Deposit received. We're starting your piece."));
  return mineOrThrow(number);
}

export async function counterQuote(number: string, quoteId: string, amount: number, note: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.counterQuote(number, quoteId, amount, note);
  await wait(500);
  const r = mineOrThrow(number);
  requireStatus(r, "QUOTED");
  if (countersUsed(r) >= MAX_COUNTERS) throw new ApiError(400, `You can counter up to ${MAX_COUNTERS} times. Accept, decline, or message us.`);
  const q = r.quotes.find((x) => x.id === quoteId);
  if (!q || q.status !== "SENT") throw new ApiError(400, "That quote isn't open any more.");
  if (!(amount > 0) || amount >= q.price) throw new ApiError(400, "A counter-offer has to be lower than the quote.", { amount: "Must be lower than the quote" });
  patchRequest(number, (x) => ({ ...x, status: "COUNTERED", quotes: x.quotes.map((y) => (y.id === quoteId ? { ...y, status: "COUNTERED", counter: { amount, note, at: new Date().toISOString() } } : y)) }), ev("COUNTERED", `Counter-offer sent: ₹${amount.toLocaleString("en-IN")}.`));
  return mineOrThrow(number);
}

export async function declineQuote(number: string, quoteId: string, reason?: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.declineQuote(number, quoteId, reason);
  await wait(400);
  const r = mineOrThrow(number);
  requireStatus(r, "QUOTED", "COUNTERED");
  patchRequest(number, (x) => ({ ...x, status: "CANCELLED", quotes: x.quotes.map((y) => (y.id === quoteId ? { ...y, status: "DECLINED" } : y)) }), ev("CANCELLED", reason ? `Quote declined: ${reason}` : "Quote declined."));
  return mineOrThrow(number);
}

export async function approveFinal(number: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.approveFinal(number);
  await wait(400);
  const r = mineOrThrow(number);
  requireStatus(r, "AWAITING_APPROVAL");
  const q = r.quotes.find((x) => x.status === "ACCEPTED");
  patchRequest(number, (x) => ({ ...x, status: "BALANCE_PENDING" }), ev("BALANCE_PENDING", q ? `Approved. Balance of ₹${balanceAmount(q).toLocaleString("en-IN")} due before shipping.` : "Approved."));
  return mineOrThrow(number);
}

export async function requestChange(number: string, note: string): Promise<CustomRequest & { extraCharge?: boolean }> {
  if (!SITE.useMock) return real.requestChange(number, note);
  await wait(400);
  const r = mineOrThrow(number);
  requireStatus(r, "AWAITING_APPROVAL");
  const q = r.quotes.find((x) => x.status === "ACCEPTED");
  const used = r.events.filter((e) => e.status === "CHANGE_REQUESTED").length;
  const extraCharge = !!q && used >= q.revisions;
  patchRequest(number, (x) => ({ ...x, status: "IN_PROGRESS", messages: [...x.messages, { id: `m${Date.now()}`, author: "customer", body: `Change requested: ${note}`, at: new Date().toISOString() }] }), ev("CHANGE_REQUESTED", note));
  return { ...mineOrThrow(number), extraCharge };
}

export async function payBalance(number: string): Promise<CustomRequest> {
  if (!SITE.useMock) return real.payBalance(number);
  await wait(800);
  const r = mineOrThrow(number);
  requireStatus(r, "BALANCE_PENDING");
  patchRequest(number, (x) => ({ ...x, status: "READY_TO_SHIP" }), ev("READY_TO_SHIP", "Paid in full. We'll ship it soon."));
  return mineOrThrow(number);
}
