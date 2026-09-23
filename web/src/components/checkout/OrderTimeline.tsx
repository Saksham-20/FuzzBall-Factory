import { EventLog, Timeline } from "@/components/ui/Timeline";
import { ORDER_FLOW, ORDER_STATUS } from "@/lib/status";
import type { Order } from "@/lib/types";

/** Where an order sits on the production line. Ended orders (cancelled, returned) show their event log instead. */
export function OrderTimeline({ order }: { order: Order }) {
  if (["CANCELLED", "RETURN_REQUESTED", "REFUNDED"].includes(order.status)) {
    return <EventLog events={order.events} kind="order" />;
  }
  // Ready-to-ship orders skip the "in production" station
  const hasMto = order.items.some((i) => i.fulfilment === "MADE_TO_ORDER");
  const flow = ORDER_FLOW.filter((s) => !s.mtoOnly || hasMto);
  const found = flow.findIndex((s) => s.key === order.status);
  const current = order.status === "DELIVERED" ? flow.length : Math.max(0, found);
  const steps = flow.map((s) => {
    const e = order.events.find((x) => x.status === s.key);
    return {
      label: s.label,
      at: e?.at,
      note: e?.note ?? (s.key === order.status ? ORDER_STATUS[order.status].hint : undefined),
      photo: e?.photo,
    };
  });
  return <Timeline steps={steps} current={current} />;
}
