import Link from "next/link";
import { Ticket } from "@/components/brand/Ticket";
import { Stamp } from "@/components/brand/Stamp";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { StationSection } from "@/components/home/StationSection";
import { SAMPLE_SETTINGS } from "@/lib/site";

const STEPS = [
  { t: "Describe it", d: "Tell us what you want. Add reference photos, pick colours, set a budget." },
  { t: "Get a quote", d: "We reply with a price, a timeline and exactly what's included." },
  { t: `Say yes, pay ${SAMPLE_SETTINGS.depositPct}%`, d: "Accept, counter, or pass. The advance is what starts your piece." },
  { t: "Watch it get made", d: "See progress photos, approve the final piece, pay the rest, and we ship it." },
] as const;

export function WorkOrders() {
  return (
    <StationSection
      id="work-orders"
      n="04"
      name="Work Orders"
      className="kraft py-[clamp(4.5rem,9vw,7.5rem)]"
      style={{ ["--hole" as string]: "var(--color-kraft-light)" }}
    >
      <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <Reveal as="h2" className="font-display text-[clamp(2.5rem,5.6vw,4.5rem)]">
            Got an idea? Put in a work order.
          </Reveal>
          <ol className="mt-8 space-y-0 divide-y divide-cocoa/15 border-y border-cocoa/15">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.t} delay={i * 50} className="grid grid-cols-[2.25rem_1fr] gap-x-3 py-4">
                <span className="font-stencil tabular grid size-8 place-items-center rounded-full bg-cocoa text-[13px] text-cream">{i + 1}</span>
                <div>
                  <h3 className="font-bold">{s.t}</h3>
                  <p className="mt-0.5 text-[15px] leading-relaxed text-brown">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/custom">Start a work order</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/shop">Customize something from the shelf</Link>
            </Button>
          </div>
          <p className="mt-5 max-w-[52ch] text-sm text-brown">
            We can&apos;t make licensed characters (Disney, Sanrio, anime and the like). Original designs only.
          </p>
        </div>

        <Reveal kind="drop" className="mx-auto w-full max-w-[440px]">
          <Ticket
            tone="paper"
            data-placeholder="example-work-order"
            head={["Work order · WO-027", "Example"]}
            className="rotate-[2deg] p-3.5"
          >
            <div className="space-y-4 px-1 pb-2">
              <div>
                <p className="font-stencil text-[11px] text-brown-soft">Request</p>
                <p className="mt-1 leading-snug">
                  A small crochet bear in a graduation cap. Cream and navy, about 15 cm. For my sister&apos;s graduation on 12 December.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 border-y border-line py-3 text-sm">
                <div>
                  <p className="font-stencil text-[11px] text-brown-soft">Quote</p>
                  <p className="tabular text-lg font-bold">₹1,850</p>
                </div>
                <div>
                  <p className="font-stencil text-[11px] text-brown-soft">To start</p>
                  <p className="tabular text-lg font-bold">₹925</p>
                </div>
                <div>
                  <p className="font-stencil text-[11px] text-brown-soft">Ready in</p>
                  <p className="tabular text-lg font-bold">8 days</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Stamp label="Requested" rotate={-3} />
                <Stamp label="Quoted" rotate={2} />
                <Stamp label="Accepted" tone="live" shape="circle" rotate={-8} />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Badge tone="sample">Example only</Badge>
                <span className="text-xs text-brown-soft">Prices and dates are illustrative.</span>
              </div>
            </div>
          </Ticket>
        </Reveal>
      </div>
    </StationSection>
  );
}
