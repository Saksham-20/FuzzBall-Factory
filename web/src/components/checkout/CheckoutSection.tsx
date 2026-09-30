import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** One numbered step of the checkout: a paper card with a stamped number and a heading. */
export function CheckoutSection({ n, title, children, className }: { n: number; title: string; children: ReactNode; className?: string }) {
  const id = `co-${n}`;
  return (
    <section aria-labelledby={id} className={cn("rounded-ticket bg-paper p-5 shadow-ticket md:p-7", className)}>
      <div className="mb-5 flex items-center gap-3">
        <span aria-hidden className="font-stencil tabular grid size-8 shrink-0 place-items-center rounded-full bg-cocoa text-[13px] text-cream">
          {n}
        </span>
        <h2 id={id} className="font-display text-[1.75rem] sm:text-[2rem]">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}
