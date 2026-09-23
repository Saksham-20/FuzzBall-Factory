import { ApiError } from "@/lib/mock/db";
import { balanceAmount, depositAmount, liveQuote } from "@/lib/api/custom";
import { formatDate, formatINR } from "@/lib/format";
import type { Category, CustomRequest, CustomStatus, Quote } from "@/lib/types";

/** Colour names the request form offers, so the request can show real swatch dots. Unknown names fall back to a dashed dot. */
const COLOUR_HEX: Record<string, string> = {
  cream: "#f1e4d3",
  "dusty rose": "#c98586",
  rose: "#c98586",
  cocoa: "#6b4228",
  butter: "#f4cd52",
  mint: "#a8c9b0",
  peach: "#f0b59a",
  cherry: "#c9403f",
  red: "#c9403f",
  navy: "#2f3f66",
  black: "#2a2422",
  lilac: "#b9a3d3",
  marigold: "#ee9a2a",
  sage: "#8fa876",
  yellow: "#f4cd52",
  white: "#fcf8f2",
};
export const colourHex = (name: string): string | undefined => COLOUR_HEX[name.trim().toLowerCase()];

export const errorMessage = (e: unknown, fallback = "Something went wrong. Please try again.") =>
  e instanceof ApiError || e instanceof Error ? e.message || fallback : fallback;

export const isNotFound = (e: unknown) => e instanceof ApiError && e.status === 404;

/** Whole days from now until `iso` (rounded up). Negative once past. */
export function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export const daysLeftLabel = (n: number) => (n <= 0 ? "expires today" : n === 1 ? "1 day left" : `${n} days left`);

export const NEEDS_YOU: CustomStatus[] = ["QUOTED", "DEPOSIT_PENDING", "AWAITING_APPROVAL", "BALANCE_PENDING"];
export const IN_PROGRESS_GROUP: CustomStatus[] = ["REQUESTED", "UNDER_REVIEW", "COUNTERED", "ACCEPTED", "IN_QUEUE", "IN_PROGRESS", "READY_TO_SHIP", "SHIPPED"];
export const ENDED: CustomStatus[] = ["DECLINED", "CANCELLED", "EXPIRED", "DELIVERED", "CLOSED"];

/** The quote the customer is looking at: the open one, or the accepted one after that. */
export function activeQuote(r: CustomRequest): Quote | undefined {
  return liveQuote(r) ?? [...r.quotes].reverse().find((q) => q.status === "ACCEPTED");
}

export function acceptedQuote(r: CustomRequest): Quote | undefined {
  return [...r.quotes].reverse().find((q) => q.status === "ACCEPTED");
}

export function needsYou(r: CustomRequest): boolean {
  if (NEEDS_YOU.includes(r.status)) return true;
  const q = liveQuote(r);
  return !!q && q.status === "SENT" && daysUntil(q.validUntil) < 2;
}

export type Group = "needs" | "progress" | "closed";
export function groupOf(r: CustomRequest): Group {
  if (needsYou(r)) return "needs";
  if (ENDED.includes(r.status)) return "closed";
  return "progress";
}

/** One line telling the customer what their next move is (or what's happening), for list rows. */
export function nextStepLine(r: CustomRequest): string | undefined {
  const q = activeQuote(r);
  switch (r.status) {
    case "QUOTED": {
      if (!q) return "A quote is ready.";
      const d = daysUntil(q.validUntil);
      return `Quote ${formatINR(q.price)}, ${d < 0 ? "expired" : daysLeftLabel(d)}`;
    }
    case "DEPOSIT_PENDING":
      return q ? `Pay ${formatINR(depositAmount(q))} to start your piece` : "Pay the deposit to start";
    case "AWAITING_APPROVAL":
      return "Your finished piece is ready for approval";
    case "BALANCE_PENDING":
      return q ? `Pay the ${formatINR(balanceAmount(q))} balance and we ship` : "Pay the balance and we ship";
    case "COUNTERED":
      return "Counter sent. Waiting for the maker";
    case "REQUESTED":
    case "UNDER_REVIEW":
      return "Waiting for a quote";
    case "IN_QUEUE":
    case "IN_PROGRESS":
      return "Being crocheted";
    default:
      return undefined;
  }
}

export const budgetLabel = (r: Pick<CustomRequest, "budgetMin" | "budgetMax">) =>
  r.budgetMin === r.budgetMax ? formatINR(r.budgetMin) : `${formatINR(r.budgetMin)} to ${formatINR(r.budgetMax)}`;

export function categoryName(slug: string, cats?: Category[]): string {
  const hit = cats?.find((c) => c.slug === slug);
  if (hit) return hit.name;
  return slug.charAt(0).toUpperCase() + slug.slice(1).replaceAll("-", " ");
}

export const longDate = (d: string | Date) => formatDate(d, { weekday: "short", day: "numeric", month: "short" });
