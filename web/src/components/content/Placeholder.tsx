import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * PLACEHOLDER(legal-details): every unknown legal or business fact (legal name, address,
 * GSTIN, officer name, phone, city of jurisdiction) is rendered through this component so it
 * is visibly bracketed on screen, highlighted, and outlined by the footer's placeholder toggle.
 * Registry: docs/PLACEHOLDERS.md
 */
export function Ph({
  children,
  id = "legal-details",
  block,
  className,
}: {
  children: ReactNode;
  id?: string;
  block?: boolean;
  className?: string;
}) {
  const Tag = block ? "div" : "span";
  return (
    <Tag
      data-placeholder={id}
      className={cn(
        "relative rounded-[4px] bg-butter/35 px-1 font-medium text-cocoa [box-decoration-break:clone]",
        block && "block",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
