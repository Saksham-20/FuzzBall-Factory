import { Stamp } from "@/components/brand/Stamp";
import { CUSTOM_STATUS, ORDER_STATUS } from "@/lib/status";
import type { CustomStatus, OrderStatus } from "@/lib/types";

export function OrderStamp({ status, className }: { status: OrderStatus; className?: string }) {
  const m = ORDER_STATUS[status];
  return <Stamp label={m.label} tone={m.tone} shape={m.shape} className={className} />;
}

export function CustomStamp({ status, className }: { status: CustomStatus; className?: string }) {
  const m = CUSTOM_STATUS[status];
  return <Stamp label={m.label} tone={m.tone} shape={m.shape} className={className} />;
}
