import { PenLine } from "lucide-react";

/**
 * PLACEHOLDER(policy-draft): renders in every build (a real-API staging site must not look finished while the policy
 * text is unreviewed). Resolving the tag means deleting this note once a lawyer has checked the pages; a launch build
 * refuses to ship while the tag is still in the source (see placeholders-scan.ts).
 */
export function DraftNote() {
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
