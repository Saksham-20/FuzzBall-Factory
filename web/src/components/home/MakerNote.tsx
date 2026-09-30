import Image from "next/image";
import { CrochetHook } from "@/components/brand/CrochetHook";
import { Stamp } from "@/components/brand/Stamp";
import { Ticket } from "@/components/brand/Ticket";
import { YarnBall } from "@/components/brand/YarnBall";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { SITE } from "@/lib/site";
import { waGeneral } from "@/lib/whatsapp";

/** PLACEHOLDER(maker-note): the maker's name and own words replace this copy (the stall photo is real). */
export function MakerNote() {
  return (
    <>
      <section className="overflow-x-clip py-[clamp(4rem,9vw,7rem)]">
        <div className="shell">
          <div className="relative mx-auto max-w-[60rem]">
            {/* Desk props beside the note: a ball of butter yarn with the hook resting on it. Only from lg,
                where there is room beside the note; narrower, they would hide behind it. */}
            <CrochetHook wound={false} className="absolute top-20 -left-9 hidden h-60 w-7 -rotate-[14deg] lg:block" />
            <YarnBall tone="butter" spin={false} className="absolute bottom-4 -left-20 hidden w-32 lg:block" />

            <Reveal kind="drop" data-placeholder="maker-note" className="relative mx-auto max-w-2xl md:max-w-none">
              <div className="relative -rotate-1 rounded-[6px] bg-paper px-6 pt-12 pb-11 shadow-lift sm:px-12 sm:pt-14 sm:pb-12">
                <span aria-hidden className="tape-strip absolute -top-3.5 left-8 h-7 w-28 -rotate-[5deg] sm:left-12" />
                <span aria-hidden className="tape-strip absolute -top-3 right-10 h-7 w-24 rotate-[6deg] sm:right-14" />

                <div className="grid items-center gap-12 md:grid-cols-[1fr_minmax(0,19rem)] md:gap-10 lg:gap-16">
                  <div>
                    <h2 className="font-display text-[clamp(2.75rem,7vw,5rem)]">Hi, I&apos;m the maker</h2>
                    <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-brown">
                      That&apos;s me at our stall at ISB, where we sold out. Every FuzzBall starts as a loop on my hook. If you can&apos;t find
                      what you&apos;re after, tell me. I&apos;d love to make it for you.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <Button asChild size="lg" variant="tape">
                        <a href={waGeneral()} target="_blank" rel="noopener noreferrer">
                          Say hi on WhatsApp
                        </a>
                      </Button>
                      <Button asChild size="lg" variant="secondary">
                        <a href={SITE.instagram} target="_blank" rel="noopener noreferrer">
                          Follow on Instagram
                        </a>
                      </Button>
                    </div>
                  </div>

                  {/* The stall, pinned to the note as a kraft ticket. The stamp lands on its corner once the
                      ticket has dropped in; its paper ground keeps the ink readable over the photo's edge. */}
                  <figure className="relative mx-auto w-full max-w-[19rem] md:max-w-none">
                    <Ticket head={["Our stall", "ISB"]} className="rotate-2">
                      <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-kraft-light">
                        <Image
                          src="/maker/founder-isb-stall.jpg"
                          alt="The maker smiling and making a peace sign at our ISB stall, with a crochet scarf, a hedgehog and a scrunchie on the table and a sold out sign taped to the front"
                          fill
                          sizes="(min-width: 768px) 304px, 80vw"
                          className="origin-[36%_52%] scale-[1.18] object-cover"
                        />
                      </div>
                      <figcaption className="px-1 pt-3 pb-1 text-sm text-brown">Our table at ISB. The sign says it all.</figcaption>
                    </Ticket>
                    <span className="stamp-seq absolute -bottom-9 -left-2 md:-left-7" style={{ ["--sd" as string]: "640ms" }}>
                      <Stamp label="Sold out" shape="ticket" rotate={-7} className="bg-paper shadow-ticket" />
                    </span>
                  </figure>
                </div>

                {/* The FF badge, stuck on the corner like a sticker. Lazy and resized: the source is a 270px PNG.
                    Square attributes to match its square box; object-contain keeps the mark's own shape. */}
                <Image
                  src="/brand/logo-mark-circle.png"
                  alt=""
                  aria-hidden
                  width={96}
                  height={96}
                  sizes="(min-width: 640px) 96px, 64px"
                  className="absolute -right-2 -bottom-7 size-16 rotate-[10deg] object-contain drop-shadow-[0_4px_6px_rgb(63_38_25/0.22)] sm:size-24 md:-right-7 md:-bottom-8"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
