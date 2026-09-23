import { formatINR } from "@/lib/format";
import { liveQuote } from "@/lib/api/custom";
import type { CustomRequest, CustomStatus, Quote } from "@/lib/types";

export interface Column {
  id: string;
  label: string;
  statuses: CustomStatus[];
  /** Whose turn it is for cards in this column. Shown as words, not colour. */
  mover: "you" | "customer" | "none";
}

/** Kanban lanes. Cards move by actions on the detail page, never by dragging. */
export const COLUMNS: Column[] = [
  { id: "new", label: "New", statuses: ["REQUESTED", "UNDER_REVIEW"], mover: "you" },
  // An expired quote waits here: the fix is a fresh quote, and the card's stamp says it expired.
  { id: "quoted", label: "Quoted", statuses: ["QUOTED", "EXPIRED"], mover: "customer" },
  { id: "countered", label: "Countered", statuses: ["COUNTERED"], mover: "you" },
  { id: "deposit", label: "Deposit due", statuses: ["ACCEPTED", "DEPOSIT_PENDING"], mover: "customer" },
  { id: "progress", label: "In progress", statuses: ["IN_QUEUE", "IN_PROGRESS"], mover: "you" },
  { id: "approval", label: "Awaiting approval", statuses: ["AWAITING_APPROVAL"], mover: "customer" },
  { id: "balance", label: "Balance due", statuses: ["BALANCE_PENDING"], mover: "customer" },
  { id: "ready", label: "Ready / shipped", statuses: ["READY_TO_SHIP", "SHIPPED"], mover: "you" },
  { id: "closed", label: "Closed", statuses: ["DELIVERED", "CLOSED", "DECLINED", "CANCELLED"], mover: "none" },
];

export const MOVER_TEXT: Record<Column["mover"], string> = { you: "Your move", customer: "Waiting on customer", none: "Done" };

export const moverOf = (s: CustomStatus): Column["mover"] => COLUMNS.find((c) => c.statuses.includes(s))?.mover ?? "none";

/** Statuses after which a needed-by date no longer matters. */
const FINISHED: CustomStatus[] = ["SHIPPED", "DELIVERED", "CLOSED", "DECLINED", "CANCELLED", "EXPIRED"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
export const daysUntil = (iso: string, now = new Date()) => Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / 864e5);

/** Text flag for a tight needed-by date. Returns null when there is time or the job is finished. */
export function dueFlag(r: Pick<CustomRequest, "neededBy" | "status">): string | null {
  if (!r.neededBy || FINISHED.includes(r.status)) return null;
  const d = daysUntil(r.neededBy);
  if (d >= 7) return null;
  if (d < 0) return `Overdue by ${-d} ${-d === 1 ? "day" : "days"}`;
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  return `Due in ${d} days`;
}

export function ageLabel(iso: string) {
  const d = -daysUntil(iso);
  if (d <= 0) return "Opened today";
  if (d === 1) return "Opened yesterday";
  if (d < 14) return `Opened ${d} days ago`;
  return `Opened ${Math.round(d / 7)} weeks ago`;
}

export const budgetLabel = (r: Pick<CustomRequest, "budgetMin" | "budgetMax">) =>
  r.budgetMin === r.budgetMax ? formatINR(r.budgetMin) : `${formatINR(r.budgetMin)}–${formatINR(r.budgetMax).replace("₹", "")}`;

/** Within a lane: soonest needed-by first, then oldest first (it has waited longest). */
export function laneSort(a: CustomRequest, b: CustomRequest) {
  const an = a.neededBy ? new Date(a.neededBy).getTime() : Infinity;
  const bn = b.neededBy ? new Date(b.neededBy).getTime() : Infinity;
  return an !== bn ? an - bn : a.createdAt.localeCompare(b.createdAt);
}

export const matchesSearch = (r: CustomRequest, q: string) => {
  const s = q.toLowerCase();
  return !s || r.number.toLowerCase().includes(s) || r.customerName.toLowerCase().includes(s) || r.title.toLowerCase().includes(s);
};

/** The price shown on a card: the quote that is live (or accepted), if there is one. */
export const quotePrice = (r: CustomRequest): number | undefined => {
  const q = liveQuote(r);
  return q ? (q.status === "COUNTERED" && q.counter ? q.counter.amount : q.price) : undefined;
};

/* ── Licensed-character hint. A nudge only; it never declines anything. ── */
const IP_NAMES = [
  "pikachu", "pokemon", "pokémon", "hello kitty", "sanrio", "kuromi", "cinnamoroll", "my melody", "disney", "mickey", "minnie", "frozen elsa",
  "marvel", "spiderman", "spider-man", "batman", "superman", "avengers", "hulk", "iron man", "naruto", "goku", "doraemon", "shin-chan", "shinchan",
  "totoro", "ghibli", "snoopy", "peppa", "paw patrol", "bluey", "cocomelon", "minecraft", "super mario", "sonic the hedgehog", "harry potter", "hogwarts", "barbie",
  "winnie the pooh", "labubu",
];
const IP_RE = new RegExp(`\\b(${IP_NAMES.map((n) => n.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")).join("|")})\\b`, "i");

export function licensedMention(r: Pick<CustomRequest, "title" | "description" | "personalization">): string | null {
  const m = IP_RE.exec(`${r.title} ${r.description} ${r.personalization ?? ""}`);
  return m ? m[1] : null;
}

export const DECLINE_TEMPLATES = [
  {
    label: "Licensed character — we only make original designs",
    text: "Thank you for asking! We only make original designs, so I can't make licensed characters. I'd love to make an original one in the same spirit if you'd like. Just tell me what you love about it.",
  },
  { label: "Can't meet that date", text: "Thank you for asking! I can't finish this one by the date you need. If there's any wiggle room on the date, message me and we'll see what's possible." },
  { label: "Outside what we make", text: "Thank you for asking! This is outside what I make, so I can't take it on. I'd be happy to help with something in the shop or another idea." },
  { label: "Budget is too low", text: "Thank you for asking! The work involved would come to more than the budget you shared, so I can't do it at that price. If you can stretch it, or simplify the design, message me and I'll quote it." },
];

/* ── Payments, read from status + quote ── */
export type PayState = "later" | "due" | "paid" | "none";

const DEPOSIT_PAID: CustomStatus[] = ["IN_QUEUE", "IN_PROGRESS", "AWAITING_APPROVAL", "BALANCE_PENDING", "READY_TO_SHIP", "SHIPPED", "DELIVERED", "CLOSED"];
const BALANCE_PAID: CustomStatus[] = ["READY_TO_SHIP", "SHIPPED", "DELIVERED", "CLOSED"];
const BEFORE_ACCEPT: CustomStatus[] = ["REQUESTED", "UNDER_REVIEW", "QUOTED", "COUNTERED", "EXPIRED"];

export function paymentStates(r: CustomRequest): { deposit: PayState; balance: PayState } {
  const s = r.status;
  const deposit: PayState = s === "ACCEPTED" || s === "DEPOSIT_PENDING" ? "due" : DEPOSIT_PAID.includes(s) ? "paid" : BEFORE_ACCEPT.includes(s) ? "later" : "none";
  const balance: PayState = s === "BALANCE_PENDING" ? "due" : BALANCE_PAID.includes(s) ? "paid" : deposit === "none" || s === "EXPIRED" ? "none" : "later";
  return { deposit, balance };
}

/** The quote to show money for: the accepted one, else the live one. */
export const moneyQuote = (r: CustomRequest): Quote | undefined => r.quotes.find((q) => q.status === "ACCEPTED") ?? liveQuote(r);

export const OPEN_FOR_QUOTE: CustomStatus[] = ["REQUESTED", "UNDER_REVIEW", "COUNTERED", "EXPIRED"];
