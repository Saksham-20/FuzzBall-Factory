import { Clock } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { CustomRequest } from "@/lib/types";
import { dueFlag } from "./workflow";

/** Needed-by date with a words-and-icon flag when it is under 7 days away. Never colour alone. */
export function Due({ r, className }: { r: Pick<CustomRequest, "neededBy" | "status">; className?: string }) {
  if (!r.neededBy) return <span className={className}>No date set</span>;
  const flag = dueFlag(r);
  return (
    <span className={className}>
      <span className="tabular">{formatDate(r.neededBy, { day: "numeric", month: "short" })}</span>
      {flag ? (
        <span className="ml-2 inline-flex items-center gap-1 font-bold text-err">
          <Clock aria-hidden className="size-3.5" strokeWidth={2} />
          {flag}
        </span>
      ) : null}
    </span>
  );
}
