import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The short privacy notice shown where personal data is collected (signup, checkout, work order, support and grievance
 * forms): what we collect here and why, plus how to withdraw consent or complain. It stands on its own, so it does not
 * rely on the reader having opened the privacy policy (DPDP Rules 2025, rule 3; docs/LEGAL_REVIEW.md).
 */
export function CollectionNotice({ what, why, className }: { what: string; why: string; className?: string }) {
  return (
    <p className={cn("text-sm leading-relaxed text-brown", className)}>
      We collect your {what} {why}. See the{" "}
      <Link className="font-medium text-cocoa underline" href="/policies/privacy" target="_blank">
        privacy policy
      </Link>
      . You can ask to see, correct or erase your data, or withdraw consent, from your account or by writing to the{" "}
      <Link className="font-medium text-cocoa underline" href="/policies/grievance" target="_blank">
        grievance officer
      </Link>
      . You can also complain to the Data Protection Board of India.
    </p>
  );
}
