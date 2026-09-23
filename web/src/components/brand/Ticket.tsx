import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Props extends ComponentPropsWithoutRef<"div"> {
  /** Stencil header row: left/right text. */
  head?: [ReactNode, ReactNode?];
  /** Punched hole at the top edge. */
  hole?: boolean;
  /** kraft (default) or paper, for tickets that sit on a kraft field. */
  tone?: "kraft" | "paper";
}

/** Kraft job ticket: the container for products, work orders, quotes and orders. */
export function Ticket({ head, hole = true, tone = "kraft", className, children, ...rest }: Props) {
  return (
    <div
      className={cn(
        "relative rounded-ticket p-2.5 shadow-ticket",
        tone === "kraft" ? "kraft" : "bg-paper",
        hole &&
          "before:absolute before:top-[7px] before:left-1/2 before:size-2 before:-translate-x-1/2 before:rounded-full before:bg-[var(--hole,var(--color-cream))] before:shadow-[inset_0_1px_1px_rgb(63_38_25/0.3)]",
        className,
      )}
      {...rest}
    >
      {head ? (
        <div className="font-stencil tabular mb-2 flex items-center justify-between px-1 pt-3 text-[11px] text-brown">
          <span>{head[0]}</span>
          {head[1] ? <span>{head[1]}</span> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
