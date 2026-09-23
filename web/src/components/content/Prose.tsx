import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Long-form text styling. Body measure is capped by the parent column (68ch);
 * lists, sub-headings, links and inline emphasis are styled here so page content stays plain JSX.
 */
export function Prose({ className, ...p }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "space-y-4 text-[1.0625rem] leading-[1.72] text-brown",
        "[&_strong]:font-semibold [&_strong]:text-cocoa",
        "[&_a]:font-medium [&_a]:text-cocoa [&_a]:underline [&_a]:decoration-kraft-deep [&_a]:underline-offset-[0.22em] [@media(hover:hover)_and_(pointer:fine)]:[&_a:hover]:decoration-cocoa",
        "[&_h3]:mt-8 [&_h3]:text-[1.1875rem] [&_h3]:leading-snug [&_h3]:font-bold [&_h3]:text-cocoa",
        "[&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:marker:text-kraft-deep",
        "[&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-5 [&_ol]:marker:font-semibold [&_ol]:marker:text-cocoa",
        className,
      )}
      {...p}
    />
  );
}

/** Scrollable, labelled data table. Caption is visually hidden but read by screen readers. */
export function DataTable({
  caption,
  head,
  rows,
  className,
}: {
  caption: string;
  head: string[];
  rows: ReactNode[][];
  className?: string;
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}
    >
      <table className="w-full min-w-[30rem] border-collapse text-left text-[15px] leading-snug">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b-2 border-cocoa/70">
            {head.map((h) => (
              <th key={h} scope="col" className="font-stencil py-2.5 pr-4 text-[12px] font-extrabold text-cocoa">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line">
              {r.map((c, j) =>
                j === 0 ? (
                  <th key={j} scope="row" className="py-3 pr-4 align-top font-semibold text-cocoa">
                    {c}
                  </th>
                ) : (
                  <td key={j} className="tabular py-3 pr-4 align-top text-brown">
                    {c}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
