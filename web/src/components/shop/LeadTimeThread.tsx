"use client";

import { addBusinessDays, formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Product } from "@/lib/types";

/** India transit assumption used until the shopper checks their own pincode (matches lib/api/shipping). */
const DEFAULT_TRANSIT_DAYS = 5;

function Connector({ dashed }: { dashed?: boolean }) {
  return (
    <svg aria-hidden viewBox="0 0 100 6" preserveAspectRatio="none" className="absolute top-[3px] left-[18px] h-1.5 w-[calc(100%-14px)]">
      <line
        x1="0"
        y1="3"
        x2="100"
        y2="3"
        stroke="var(--color-rose)"
        strokeWidth="3"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        strokeDasharray={dashed ? "8 7" : undefined}
        className={dashed ? "thread-march" : undefined}
      />
    </svg>
  );
}

interface Props {
  product: Pick<Product, "fulfilment" | "leadTimeDays">;
  /** ISO delivery estimate from the delivery check, if the shopper ran one. */
  deliverBy?: string;
  className?: string;
}

/** "Ordered today, made by, delivered around": the lead time drawn as a three-node thread. */
export function LeadTimeThread({ product, deliverBy, className }: Props) {
  const ready = product.fulfilment === "READY";
  const now = new Date();
  const madeBy = addBusinessDays(now, product.leadTimeDays);
  const arrive = deliverBy ? new Date(deliverBy) : addBusinessDays(madeBy, DEFAULT_TRANSIT_DAYS);

  const nodes = [
    { title: "Ordered today", sub: formatDate(now) },
    ready ? { title: "Leaves the factory", sub: "in 1–2 days" } : { title: "Made by", sub: formatDate(madeBy) },
    { title: "Delivered around", sub: formatDate(arrive) },
  ];

  return (
    <div className={cn("rounded-ticket bg-paper p-4 shadow-ticket", className)}>
      <p className="font-semibold">
        {ready ? "Leaves the factory in 1–2 days." : `Made just for you: ready in about ${product.leadTimeDays} days.`}
      </p>
      <ol aria-label="Order timeline" className="mt-4 grid grid-cols-3 gap-x-2">
        {nodes.map((node, i) => (
          <li key={node.title} className="relative min-w-0">
            <span
              aria-hidden
              className={cn(
                "relative z-10 block size-3 rounded-full",
                i === 0 ? "bg-cocoa" : "border-2 border-cocoa bg-paper",
              )}
            />
            {i < 2 ? <Connector dashed={i === 1} /> : null}
            <p className="mt-2 text-[13px] leading-tight text-brown">{node.title}</p>
            <p className="tabular text-[15px] leading-snug font-bold">{node.sub}</p>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-brown">
        {deliverBy
          ? "Delivery date is for the place you checked below."
          : "An estimate for India. Check your pincode or country below for yours."}
      </p>
    </div>
  );
}
