import { ORDER_FLOW } from "@/lib/status";
import type { TimelineStep } from "@/components/ui/Timeline";
import type { Order, OrderStatus } from "@/lib/types";

export interface OrderProgress {
  steps: TimelineStep[];
  current: number;
  waiting?: boolean;
}

const TERMINAL: Partial<Record<OrderStatus, string>> = {
  CANCELLED: "Cancelled",
  RETURN_REQUESTED: "Return requested",
  REFUNDED: "Refunded",
};

/** Timeline steps for an order: the flow stations that apply to it, with the time and note of each event we have. */
export function orderProgress(o: Order): OrderProgress {
  const hasMto = o.items.some((i) => i.fulfilment === "MADE_TO_ORDER");
  const flow = ORDER_FLOW.filter((f) => !f.mtoOnly || hasMto);
  const eventFor = (status: string) => o.events.find((e) => e.status === status);

  const flowSteps = (upTo: number): TimelineStep[] =>
    flow.slice(0, upTo).map((f) => {
      const e = eventFor(f.key);
      return { label: f.label, at: e?.at, note: e?.note };
    });

  if (o.status === "PENDING_PAYMENT") {
    return {
      steps: [{ label: "Awaiting payment", at: o.events[0]?.at, note: "We start on your order the moment payment goes through." }, ...flow.map((f) => ({ label: f.label }))],
      current: 0,
      waiting: true,
    };
  }

  const terminal = TERMINAL[o.status];
  if (terminal) {
    const last = o.events.findLast((e) => e.status === o.status);
    // Only stations the order actually reached, then the ending.
    const reached = flow.filter((f) => eventFor(f.key)).length;
    const steps = [...flowSteps(Math.max(reached, 1)), { label: terminal, at: last?.at, note: last?.note }];
    // A return request is still live; cancelled and refunded are finished.
    return { steps, current: o.status === "RETURN_REQUESTED" ? steps.length - 1 : steps.length };
  }

  const idx = flow.findIndex((f) => f.key === o.status);
  const steps = flow.map((f) => {
    const e = eventFor(f.key);
    return { label: f.label, at: e?.at, note: e?.note };
  });
  // Delivered is the end of the line: every station done.
  return { steps, current: o.status === "DELIVERED" ? steps.length : Math.max(idx, 0) };
}

/** A short window of the timeline (previous, current, next) for the overview. */
export function compactWindow(p: OrderProgress, size = 3): { steps: TimelineStep[]; current: number } {
  const total = p.steps.length;
  const focus = Math.min(p.current, total - 1);
  const start = Math.max(0, Math.min(focus - 1, total - size));
  const steps = p.steps.slice(start, start + size).map((s) => ({ label: s.label, at: s.at }));
  return { steps, current: p.current >= total ? steps.length : p.current - start };
}
