import { PenLine } from "lucide-react";
import { SITE } from "@/lib/site";

/**
 * PLACEHOLDER(policy-draft): this note only renders while the site runs on sample data
 * (NEXT_PUBLIC_USE_MOCK is not "false"). The policy text underneath still needs legal review.
 */
export function DraftNote() {
  if (!SITE.useMock) return null;
  return (
    <p
      data-placeholder="policy-draft"
      className="relative flex max-w-[68ch] items-start gap-3 rounded-[12px] bg-butter/30 px-4 py-3 text-[15px] leading-snug text-cocoa"
    >
      <PenLine aria-hidden strokeWidth={1.8} className="mt-0.5 size-5 shrink-0" />
      <span>
        <strong className="font-bold">Draft: have this reviewed before launch.</strong> This page is a working
        draft. A lawyer should check it, and every bracketed detail needs the real answer.
      </span>
    </p>
  );
}
