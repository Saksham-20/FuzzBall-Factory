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

/**
 * A legal fact from `LEGAL` (src/lib/legal.ts): the value when the owner has supplied it, a bracketed placeholder
 * (outlined by the footer toggle, refused by the launch build) while it is still `null`.
 */
export function LegalValue({ value, label, id }: { value: string | null | undefined; label: string; id?: string }) {
  return value ? <>{value}</> : <Ph id={id}>[{label}]</Ph>;
}
