import { Badge } from "@/components/ui/Badge";
import { timeLeftLabel } from "@/lib/support";
import type { SlaState, TicketStatus } from "@/lib/types";

const TONE: Record<SlaState, "ready" | "mto" | "err" | "sold" | undefined> = { done: "ready", ok: undefined, "due-soon": "mto", overdue: "err" };

/** A deadline in words ("5 hours left", "overdue by 2 days") with a badge. Never colour alone. */
export function SlaCell({ state, ms, doneLabel = "Done" }: { state: SlaState; ms: number; doneLabel?: string }) {
  if (state === "done") return <Badge tone="ready">{doneLabel}</Badge>;
  const tone = TONE[state];
  return tone ? <Badge tone={tone}>{timeLeftLabel(ms)}</Badge> : <span className="tabular text-sm text-brown">{timeLeftLabel(ms)}</span>;
}

export const STATUS_TONE: Record<TicketStatus, "mto" | "ooak" | "ready" | "sold"> = { OPEN: "mto", WAITING_CUSTOMER: "ooak", RESOLVED: "ready", CLOSED: "sold" };
