import Image from "next/image";
import type { OrderItem } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Overlapping row of item photos, capped, with a "+N" for the rest. */
export function OrderThumbs({ items, max = 4, className }: { items: OrderItem[]; max?: number; className?: string }) {
  const shown = items.slice(0, max);
  const more = items.length - shown.length;
  return (
    <ul className={cn("flex items-center", className)} aria-label={`${items.length} ${items.length === 1 ? "item" : "items"}`}>
      {shown.map((i, n) => (
        <li key={`${i.productId}-${n}`} className={cn("relative size-14 overflow-hidden rounded-[10px] bg-paper ring-2 ring-kraft-light", n > 0 && "-ml-3")}>
          <Image src={i.image} alt={i.name} fill sizes="56px" className="object-cover" />
        </li>
      ))}
      {more > 0 ? <li className="tabular font-stencil -ml-3 grid size-14 place-items-center rounded-[10px] bg-paper text-[12px] ring-2 ring-kraft-light">+{more}</li> : null}
    </ul>
  );
}
