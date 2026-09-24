import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
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

const field =
  "h-12 w-full rounded-[12px] border-[1.5px] border-line-strong bg-cream px-4 text-base text-cocoa placeholder:text-brown-soft/80 focus-visible:border-rose-deep";

export function ShippingDock() {
  return (
    <StationSection id="shipping-dock" n="05" name="Shipping Dock" className="pb-[clamp(10rem,16vw,14rem)]">
      <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <Reveal as="h2" className="font-display text-[clamp(2.5rem,5.6vw,4.5rem)]">
            Packed with care, shipped anywhere
          </Reveal>
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
              <form action="/track" method="get" className="mt-5 space-y-3 border-t-2 border-dashed border-line-strong pt-5">
                <div>
                  <label htmlFor="track-order" className="mb-1.5 block text-sm font-semibold">
                    Order number
                  </label>
                  <input id="track-order" name="order" placeholder="FB-1023" autoComplete="off" required className={field} />
                </div>
                <div>
                  <label htmlFor="track-phone" className="mb-1.5 block text-sm font-semibold">
                    Phone number
                  </label>
                  <input
                    id="track-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="With country code"
                    autoComplete="tel"
                    required
                    className={field}
                  />
                </div>
                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  Track my order
                </Button>
              </form>
            </div>
          </Ticket>
        </Reveal>
      </div>
    </StationSection>
  );
}
