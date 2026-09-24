import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

interface Props extends ComponentPropsWithoutRef<"div"> {
  /** Stencil header row: left/right text. */
  head?: [ReactNode, ReactNode?];
  /** Smaller head on phones, for tickets two to a row (product grids), so both labels keep one line. */
  compactHead?: boolean;
  /** Punched hole at the top edge. */
  hole?: boolean;
  /** kraft (default) or paper, for tickets that sit on a kraft field. */
  tone?: "kraft" | "paper";
}

/** Kraft job ticket: the container for products, work orders, quotes and orders. */
export function Ticket({ head, compactHead, hole = true, tone = "kraft", className, children, ...rest }: Props) {
  const rightIsText = typeof head?.[1] === "string" || typeof head?.[1] === "number";
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
        // One line, always: the head's height is fixed, so anything positioned below it stays put.
        // Labels never break inside themselves. When both can't fit, text gives way to an element
        // (a badge stays whole), and between two text labels the right one is cut short.
        <div
          className={cn(
            "font-stencil tabular mb-2 flex items-center justify-between px-1 pt-3 text-brown",
            compactHead ? "gap-2 text-[11px] sm:gap-3 sm:text-[12px]" : "gap-3 text-[12px]",
          )}
        >
          <span className={rightIsText ? "shrink-0 whitespace-nowrap" : "min-w-0 truncate"}>{head[0]}</span>
          {head[1] ? <span className={rightIsText ? "min-w-0 truncate" : "shrink-0"}>{head[1]}</span> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
