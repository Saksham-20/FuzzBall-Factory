import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import type { useBasket } from "@/components/checkout/useBasket";
import { formatINR } from "@/lib/format";

/** The pieces in the order, one row each: photo, name, variant, how it ships, and the line price. */
export function OrderLines({ items }: { items: ReturnType<typeof useBasket>["items"] }) {
  return (
    <ul className="divide-y divide-cocoa/15">
      {items.map(({ line, product: p, variant: v, unitPrice }) => (
        <li key={line.variantId} className="flex gap-3 py-3">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-[10px] bg-paper">
            <Image src={p.images[0].src} alt="" fill sizes="64px" className="object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug">{p.name}</p>
            <p className="text-sm text-brown">{[v.colour, v.size].filter(Boolean).join(" · ")}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {p.fulfilment === "READY" ? <Badge tone="ready">Ready to ship</Badge> : <Badge tone="mto">Made to order · {p.leadTimeDays} days</Badge>}
            </div>
          </div>
          <p className="tabular shrink-0 text-right text-sm">
            <span className="block font-bold">{formatINR(unitPrice * line.qty)}</span>
            {line.qty > 1 ? <span className="text-brown-soft">
              {line.qty} × {formatINR(unitPrice)}
            </span> : null}
          </p>
        </li>
      ))}
    </ul>
  );
}
