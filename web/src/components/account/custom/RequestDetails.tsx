import Link from "next/link";
import { Ticket } from "@/components/brand/Ticket";
import { formatDate } from "@/lib/format";
import type { Category, CustomRequest } from "@/lib/types";
import { budgetLabel, categoryName, colourHex } from "./helpers";

function Item({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-sm text-brown">{label}</dt>
      <dd className="mt-0.5 [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export function RequestDetails({ r, cats, baseName }: { r: CustomRequest; cats?: Category[]; baseName?: string }) {
  return (
    <Ticket tone="paper" role="region" aria-labelledby="req-title" head={["Your request", r.kind === "CUSTOMIZE" ? "Customize" : "New idea"]}>
      <div className="space-y-5 px-1 pb-2">
        <h2 id="req-title" className="font-display text-[1.75rem] leading-[1.05]">
          What you asked for
        </h2>
        <p className="max-w-[62ch] leading-relaxed">{r.description}</p>

        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Item label="Category">{categoryName(r.category, cats)}</Item>
          <Item label="Quantity">
            <span className="tabular">{r.quantity}</span>
          </Item>
          <Item label="Size">{r.size}</Item>
          <Item label="Your budget">
            <span className="tabular">{budgetLabel(r)}</span>
          </Item>
          <Item label="Colours" wide>
            {r.colours.length ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-2">
                {r.colours.map((c) => {
                  const hex = colourHex(c);
                  return (
                    <li key={c} className="inline-flex items-center gap-2">
                      <span aria-hidden className={`size-5 rounded-full border ${hex ? "border-cocoa/20" : "border-dashed border-brown-soft"}`} style={hex ? { background: hex } : undefined} />
                      {c}
                    </li>
                  );
                })}
              </ul>
            ) : (
              "No preference"
            )}
          </Item>
          {r.occasion ? <Item label="Occasion">{r.occasion}</Item> : null}
          {r.neededBy ? (
            <Item label="Needed by">
              <span className="tabular">{formatDate(r.neededBy, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
            </Item>
          ) : null}
          {r.personalization ? (
            <Item label="Personalization" wide>
              {r.personalization}
            </Item>
          ) : null}
          {r.kind === "CUSTOMIZE" && r.baseProductSlug ? (
            <Item label="Based on" wide>
              <Link href={`/p/${r.baseProductSlug}`} className="font-semibold underline underline-offset-4">
                {baseName ?? r.baseProductSlug.replaceAll("-", " ")}
              </Link>
            </Item>
          ) : null}
          <Item label="Deliver to">
            <span className="tabular">
              {r.country === "IN" ? "India" : r.country} {r.postalCode}
            </span>
          </Item>
        </dl>

        <div>
          <h3 className="text-sm text-brown">Reference images</h3>
          {r.references.length === 0 ? (
            <p className="mt-1 text-[15px] text-brown">You didn&apos;t add any. You can send photos in the messages.</p>
          ) : (
            <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {r.references.map((src, i) => (
                <li key={i}>
                  <a href={src} target="_blank" rel="noopener noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Reference image ${i + 1} for ${r.title}`} loading="lazy" className="aspect-square w-full rounded-[10px] bg-kraft-light object-cover" />
                    <span className="sr-only">Opens the full image in a new tab</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Ticket>
  );
}
