import Image from "next/image";
import Link from "next/link";
import { Ticket } from "@/components/brand/Ticket";
import { Tape } from "@/components/brand/Tape";
import { YarnBall } from "@/components/brand/YarnBall";
import { Button } from "@/components/ui/Button";
import { serverProducts } from "@/lib/catalog-server";
import { formatINR } from "@/lib/format";
import { SITE } from "@/lib/site";
import { waGeneral } from "@/lib/whatsapp";

// Shipping and payment are on the line under the buttons, so the tape keeps to the shop's story.
const TAPE = ["Handmade in India", "Sold out at ISB", "Ready to ship & made to order", "Custom work orders open"] as const;

const line = (i: number) => ({ ["--i" as string]: i });

export async function Hero() {
  // Same rule as the whale section: never send the first click to an empty shelf. Until a whale is listed the
  // buttons ask for one (a work order) or open WhatsApp.
  const whales = await serverProducts({ category: "keychains" });
  const listed = whales.length > 0;
  // The ticket on the thread carries the whales' price once they are listed (the lowest, if colours differ).
  const from = listed ? Math.min(...whales.map((p) => p.price)) : 0;
  return (
    <section data-hero className="relative flex min-h-[calc(100svh-68px)] flex-col overflow-x-clip md:min-h-[calc(100svh-76px)]">
      <div className="shell relative flex flex-1 items-center py-8 md:py-12 lg:py-6">
        <div className="conveyor-indent grid w-full items-center gap-6 lg:grid-cols-[1.12fr_0.88fr] lg:gap-10">
          <div data-hero-copy className="order-2 lg:order-1">
            <h1 className="font-display text-[clamp(3.1rem,min(9.4vw,15svh),7.5rem)]">
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

            {/* Side by side the ticket hangs beside these lines: below 1280 the measure narrows with the viewport so the
                text ends well left of it (66vw - 20rem tracks the ticket's left edge, less a clear gap). */}
            <p className="hero-rise mt-6 max-w-[46ch] text-[1.0625rem] leading-relaxed text-brown md:text-lg lg:max-w-[min(46ch,66vw_-_20rem)]" style={line(3)}>
              {listed
                ? "Whale keychains crocheted by hand, one loop at a time. Pick a colour, or ask for one made just for you."
                : "Whale keychains crocheted by hand, one loop at a time. Ask for one in your colour."}
            </p>

            <div className="hero-rise mt-8 flex flex-wrap gap-3" style={line(4)}>
              {listed ? (
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

            {/* pr-16 on phones: the line sits at the foot of the first screen, where the WhatsApp button floats. */}
            <p className="hero-rise mt-6 pr-16 text-[15px] text-brown-soft sm:pr-0" style={line(5)}>
              Ships across India{SITE.shipsInternational ? " and worldwide" : ""} · UPI, cards, <span className="whitespace-nowrap">cash on delivery</span>
            </p>
          </div>

          {/* The ball and the whale ticket hanging on its thread. Stacked (phones, tablets) the ticket sits in the flow
              beside the ball (a reversed row: ticket left, ball right), so the hero keeps exactly the room it needs;
              the thread leaves the ball's upper left (200°). Side by side, the ticket hangs below the ball's lower
              left (125°) and the block reserves that drop. Side by side the ball sits at its column's right edge, grows
              from 288px at 1024 to 320px, and shrinks on a short screen (40svh), so the ticket clears the copy with room
              for the thread and ball, ticket and tape fit a laptop's first screen. */}
          <div className="hero-ball order-1 flex flex-row-reverse items-start gap-3 lg:relative lg:order-2 lg:mr-0 lg:mb-[13.75rem] lg:ml-auto lg:block lg:w-full lg:max-w-[min(clamp(18rem,43.75vw_-_10rem,20rem),40svh)]">
            {/* No idle sway: the wraps turn as the thread pays out (ConveyorThread). */}
            <div className="relative w-[min(44vw,200px)] shrink-0 md:w-[240px] lg:w-full">
              <YarnBall
                tone="rose"
                spin={false}
                tailAnchor
                tailClassName="left-[5.4%] top-[33.8%] lg:left-[22.7%] lg:top-[89.5%]"
                title="A ball of rose-coloured yarn"
              />
            </div>
            {/* The thread runs from the ball's tail through the punched hole (data-thread-hole), along the ticket's top
                edge and off its left side. The ticket starts 3px below the tail and 12px clear of the ball, so the
                thread is seen leaving the ball; its head drops under the thread. It swings from the hole on arrival
                (ticket-swing), so the hole never leaves the line. */}
            <a
              href="#pod-h"
              aria-label="Meet the whales"
              data-thread-tag
              className="mt-[calc(0.338*min(44vw,200px)+3px)] block w-[min(32vw,124px)] shrink-0 -rotate-[4deg] rounded-ticket md:mt-[calc(0.338*240px+3px)] md:w-[150px] lg:absolute lg:top-[calc(89.5%+3px)] lg:right-[calc(77.3%+12px)] lg:mt-0 lg:w-[158px]"
            >
              {/* Under 360px the head can't hold both labels: the price stays and the word goes (the photo shows whales). */}
              <Ticket
                head={from ? [<span key="w" className="max-[22.5rem]:hidden">Whales</span>, formatINR(from)] : ["Whales"]}
                className="ticket-swing press hf:hover:shadow-lift [&_[data-ticket-head]]:pt-6"
              >
                <span data-thread-hole aria-hidden className="pointer-events-none absolute top-[11px] left-1/2 size-px" />
                <div className="relative aspect-square overflow-hidden rounded-[8px] bg-kraft-light">
                  <Image
                    src="/maker/whale-pod.jpg"
                    alt=""
                    fill
                    priority
                    sizes="158px"
                    className="object-cover object-[50%_62%]"
                  />
                </div>
                {/* Below md the head's price says it, and a two-line caption would push the headline down. */}
                <p className="hidden px-1 pt-2 pb-1 text-sm leading-snug font-semibold text-cocoa md:block">Meet the whales</p>
              </Ticket>
            </a>
          </div>
        </div>
      </div>
      <Tape items={TAPE} className="relative z-30 pb-3" />
    </section>
  );
}
