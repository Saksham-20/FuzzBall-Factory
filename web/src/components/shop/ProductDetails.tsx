"use client";

import Link from "next/link";
import { Accordion, AccordionItem } from "@/components/ui/Tabs";
import { SAMPLE_SETTINGS } from "@/lib/site";
import { formatINR } from "@/lib/format";
import type { Product } from "@/lib/types";

/** Story, details, care, shipping and returns, and the colour note, as an accordion. */
export function ProductDetails({ product: p, className }: { product: Product; className?: string }) {
  const rows: [string, string][] = [
    ["Fiber", p.fiber],
    ["Size", p.sizeCm],
    ["Weight", `${p.weightG} g`],
    ["Origin", "Made in India"],
  ];
  const personalised = p.tags.includes("personalizable");

  return (
    <Accordion type="multiple" defaultValue={["about", "details"]} className={className}>
      <AccordionItem value="about" title="About this piece">
        <p className="max-w-[68ch]">{p.description}</p>
      </AccordionItem>

      <AccordionItem value="details" title="Details">
        <dl className="grid max-w-[36rem] grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold text-cocoa">{k}</dt>
              <dd className="tabular">{v}</dd>
            </div>
          ))}
        </dl>
      </AccordionItem>

      <AccordionItem value="care" title="Care">
        <ul className="max-w-[68ch] list-disc space-y-1.5 pl-5 marker:text-brown-soft">
          {p.care.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </AccordionItem>

      <AccordionItem value="shipping" title="Shipping & returns">
        {/* PLACEHOLDER(pdp-returns-copy): draft wording, confirm with the maker and the policy pages. */}
        <div data-placeholder="pdp-returns-copy" className="relative max-w-[68ch] space-y-3">
          <p>
            {p.fulfilment === "READY"
              ? "Ready-to-ship pieces leave the factory in 1–2 days."
              : `This piece is crocheted after you order. The lead time above (about ${p.leadTimeDays} days) is when it is finished, before shipping.`}{" "}
            India shipping is {formatINR(SAMPLE_SETTINGS.domesticShipping)}, free above {formatINR(SAMPLE_SETTINGS.freeShippingAbove)}. Worldwide shipping starts at{" "}
            {formatINR(SAMPLE_SETTINGS.intlFrom)} and is priced by country at checkout.
          </p>
          <p>
            {p.fulfilment === "READY" && !personalised
              ? "Ready-to-ship pieces can be exchanged or refunded within 7 days if you send an unboxing video."
              : "Made-to-order, custom and personalised pieces are made just for you, so they can't be returned or exchanged unless they arrive damaged or wrong."}{" "}
            <Link href="/policies/refund" className="font-semibold text-cocoa underline">
              Read the full policy
            </Link>
            .
          </p>
        </div>
      </AccordionItem>

      <AccordionItem value="colour" title="Colour note">
        <p className="max-w-[68ch]">
          Colours may vary slightly between screens and yarn batches. Every piece is made by hand, so no two are exactly alike. If a shade matters, message us and we will send a photo in natural light.
        </p>
      </AccordionItem>
    </Accordion>
  );
}
