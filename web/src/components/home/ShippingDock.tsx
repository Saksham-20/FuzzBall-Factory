import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { StationSection } from "@/components/home/StationSection";
import { serverProducts } from "@/lib/catalog-server";
import { formatINR } from "@/lib/format";
import { POLICY } from "@/lib/policy-constants";
import { SAMPLE_SETTINGS as S, SITE } from "@/lib/site";
import { waGeneral } from "@/lib/whatsapp";

/** PLACEHOLDER(shipping-rates): sample rates, confirm with the maker (see SAMPLE_SETTINGS). */
const FACTS = [
  // India only: the heading names the country already, so the row says what it covers.
  { term: SITE.shipsInternational ? "India" : "Shipping", text: `${formatINR(S.domesticShipping)} flat. Free above ${formatINR(S.freeShippingAbove)}.` },
  SITE.shipsInternational
    ? { term: "Worldwide", text: `From ${formatINR(S.intlFrom)}, priced by region. You see it before you pay.` }
    : { term: "Returns", text: `Exchange or refund an unused ready-to-ship piece within ${POLICY.returnWindowDays} days. Damaged or wrong on arrival? We repair, replace or refund it.` },
  { term: "Gifting", text: `Gift wrap and a handwritten note for ${formatINR(S.giftWrapPrice)}.` },
  { term: "Paying", text: `UPI, cards and netbanking. Cash on delivery for ready-to-ship pieces up to ${formatINR(S.codCap)}.` },
];

/**
 * Station 04, the end of the line: what shipping, returns, gifting and paying cost, a way to track an order, and one
 * last way in (the buy ticket, where the thread runs out). Same rule as the shelf: never send the last click to an
 * empty shelf, and never print a price that isn't a listing's.
 */
export async function ShippingDock() {
  const whales = await serverProducts({ category: "keychains" });
  const from = whales.length ? Math.min(...whales.map((p) => p.price)) : 0;
  const allReady = whales.length > 0 && whales.every((p) => p.fulfilment === "READY");
  return (
    <StationSection id="shipping-dock" n="04" name="Shipping Dock" headingId="dock-h" className="pb-[var(--spacing-section)]">
      <h2 id="dock-h" className="font-display text-[clamp(2.5rem,5.6vw,4.5rem)]">
        {SITE.shipsInternational ? "Packed with care, shipped anywhere" : "Packed with care, shipped across India"}
      </h2>
      <dl data-placeholder="shipping-rates" className="relative mt-8 grid border-b border-line md:grid-cols-2 md:gap-x-12">
        {FACTS.map((f, i) => (
          <Reveal key={f.term} delay={i * 50} className="border-t border-line py-4">
            <dt className="font-stencil text-[13px] text-brown">{f.term}</dt>
            <dd className="mt-1 text-lg leading-snug">{f.text}</dd>
          </Reveal>
        ))}
      </dl>
      {/* Right-aligned from md: the crochet hook parked on the buy ticket below leans up through the left edge. */}
      <div className="mt-5 md:flex md:justify-end">
        <Link href="/track" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-cocoa underline underline-offset-4">
          Already ordered? Track it <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>

      {/* The last way in, and where the thread runs out: it leaves the gutter and its loose end parks on this
          ticket's edge, with the hook resting on it. data-thread-end sits on a wrapper the drop-in never moves, so
          the thread measures where the ticket lands, not where it starts its fall. */}
      <div data-thread-end className="mt-12">
        <Reveal kind="drop">
          <Ticket tone="paper" className="p-4 pt-8 sm:p-6 sm:pt-9 md:flex md:items-center md:justify-between md:gap-8">
            <div className="px-1">
              <h3 className="font-display text-[clamp(1.75rem,3vw,2.25rem)]">{whales.length ? "Pick your whale" : "Want a whale?"}</h3>
              <p className="mt-2 max-w-[46ch] leading-relaxed text-brown">
                {whales.length
                  ? `Whale keychains from ${formatINR(from)}${allReady ? ", ready to ship" : ""}. Or tell us what you'd like made.`
                  : "Ask for one in your colour, or tell us what you'd like made."}
              </p>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 px-1 pb-1 md:mt-0 md:shrink-0">
              {whales.length ? (
                <>
                  <Button asChild size="lg">
                    <Link href="/shop/keychains">Shop the whales</Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <Link href="/custom">Make me one</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/custom?idea=whale">Ask for a whale</Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <a href={waGeneral()} target="_blank" rel="noopener noreferrer">
                      Ask on WhatsApp
                    </a>
                  </Button>
                </>
              )}
            </div>
          </Ticket>
        </Reveal>
      </div>
    </StationSection>
  );
}
