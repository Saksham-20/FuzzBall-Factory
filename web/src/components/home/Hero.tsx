import Link from "next/link";
import { Ticket } from "@/components/brand/Ticket";
import { Tape } from "@/components/brand/Tape";
import { YarnBall } from "@/components/brand/YarnBall";
import { Button } from "@/components/ui/Button";

const TAPE = [
  "Handmade in India",
  "Ready to ship & made to order",
  "UPI · Cards · COD",
  "Ships worldwide",
  "Custom work orders open",
] as const;

const line = (i: number) => ({ ["--i" as string]: i });

export function Hero() {
  return (
    <section data-hero className="relative flex min-h-[calc(100svh-68px)] flex-col overflow-x-clip md:min-h-[calc(100svh-76px)]">
      <div className="shell relative flex flex-1 items-center py-8 md:py-12">
        <div className="conveyor-indent grid w-full items-center gap-6 lg:grid-cols-[1.12fr_0.88fr] lg:gap-10">
          <div className="order-2 lg:order-1">
            <h1 className="font-display text-[clamp(3.1rem,9.4vw,7.5rem)]">
              <span className="hero-rise block" style={line(0)}>
                Yarn in.
              </span>
              <span className="hero-rise relative block w-fit" style={line(1)}>
                <span aria-hidden className="absolute inset-x-[-2.5%] bottom-[4%] -z-0 h-[42%] -rotate-1 bg-butter" />
                <span className="relative">Fuzzballs</span>
              </span>
              <span className="hero-rise block" style={line(2)}>
                out.
              </span>
            </h1>

            <p className="hero-rise mt-6 max-w-[46ch] text-[1.0625rem] leading-relaxed text-brown md:text-lg" style={line(3)}>
              Plushies, bouquets, bags and wearables crocheted by hand. Ready to ship, or made to order just for you.
            </p>

            <div className="hero-rise mt-8 flex flex-wrap gap-3" style={line(4)}>
              <Button asChild size="lg">
                <Link href="/shop">Shop the shelf</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/custom">Start a work order</Link>
              </Button>
            </div>

            <p className="hero-rise font-stencil mt-6 text-[12px] text-brown-soft" style={line(5)}>
              Ships across India &amp; worldwide · UPI, cards, COD
            </p>
          </div>

          <div className="hero-ball relative order-1 ml-auto w-[min(62vw,290px)] lg:order-2 lg:mx-auto lg:w-full lg:max-w-[500px]">
            <YarnBall tone="rose" tailAnchor title="A ball of rose-coloured yarn" />
            <Ticket
              head={["Batch #001", "One of one"]}
              className="absolute -right-2 -bottom-3 w-[132px] rotate-[5deg] md:-right-4 md:-bottom-5 md:w-[168px]"
            >
              <p className="px-1 pb-1.5 text-[13px] leading-snug font-semibold text-cocoa md:text-[15px]">Wound by hand, ready to unspool.</p>
            </Ticket>
          </div>
        </div>
      </div>
      <Tape items={TAPE} className="relative z-30 pb-3" />
    </section>
  );
}
