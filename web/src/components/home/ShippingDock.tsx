import { Ticket } from "@/components/brand/Ticket";
import { TrackDockForm } from "@/components/home/TrackDockForm";
import { Reveal } from "@/components/ui/Reveal";
import { StationSection } from "@/components/home/StationSection";
import { formatINR } from "@/lib/format";
import { SAMPLE_SETTINGS as S } from "@/lib/site";

/** PLACEHOLDER(shipping-rates): sample rates, confirm with the maker (see SAMPLE_SETTINGS). */
const FACTS = [
  { term: "India", text: `${formatINR(S.domesticShipping)} flat. Free above ${formatINR(S.freeShippingAbove)}.` },
  { term: "Worldwide", text: `From ${formatINR(S.intlFrom)}, priced by region. You see it before you pay.` },
  { term: "Gifting", text: `Gift wrap and a handwritten note for ${formatINR(S.giftWrapPrice)}.` },
  { term: "Paying", text: `UPI, cards and netbanking. Cash on delivery for ready-to-ship pieces up to ${formatINR(S.codCap)}.` },
] as const;

export function ShippingDock() {
  return (
    <StationSection id="shipping-dock" n="05" name="Shipping Dock" className="pb-[clamp(10rem,16vw,14rem)]">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <Reveal as="h2" className="font-display text-[clamp(2.5rem,5.6vw,4.5rem)]">
            Packed with care, shipped anywhere
          </Reveal>
          <a href="#track-order" className="mt-3 inline-block min-h-11 text-sm font-semibold text-cocoa underline lg:hidden">
            Already ordered? Skip to tracking
          </a>
          <dl data-placeholder="shipping-rates" className="relative mt-8 divide-y divide-line border-y border-line">
            {FACTS.map((f, i) => (
              <Reveal key={f.term} delay={i * 50} className="grid gap-x-6 gap-y-1 py-4 sm:grid-cols-[9rem_1fr]">
                <dt className="font-stencil text-[13px] text-brown">{f.term}</dt>
                <dd className="text-lg leading-snug">{f.text}</dd>
              </Reveal>
            ))}
          </dl>
        </div>

        <Reveal as="div" delay={80} className="self-end">
          {/* The tracking form as a parcel label: a paper tag with a tear line above the fields. No stencil
              head: stacked over the heading it read as an eyebrow, and it repeated the station's own name. */}
          <Ticket tone="paper" className="p-4 pt-8 sm:p-5 sm:pt-9">
            <div className="px-1 pb-1">
              <h3 className="font-display text-[clamp(1.75rem,3vw,2.25rem)]">Already ordered? Track it.</h3>
              <TrackDockForm />
            </div>
          </Ticket>
        </Reveal>
      </div>
    </StationSection>
  );
}
