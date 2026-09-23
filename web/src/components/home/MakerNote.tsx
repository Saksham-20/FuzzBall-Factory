import Image from "next/image";
import type { CSSProperties } from "react";
import { CrochetHook } from "@/components/brand/CrochetHook";
import { YarnBall } from "@/components/brand/YarnBall";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { products } from "@/lib/mock/catalog";
import { SITE } from "@/lib/site";
import { waGeneral } from "@/lib/whatsapp";

const tiles = [products[0], products[2], products[1], products[3], products[5], products[6]];

/** How far the line sags under each peg: the same curve as the drawn line (a parabola, 22px deep). */
const sag = (i: number) => {
  const t = (i + 0.5) / tiles.length;
  return 4 + 72 * t * (1 - t);
};
const TILT = [-3, 2, -1.5, 3, -2, 1.5];

/** PLACEHOLDER(maker-note): the maker's name, photo and own words replace this copy. */
export function MakerNote() {
  return (
    <>
      <section className="overflow-x-clip py-[clamp(4rem,9vw,7rem)]">
        <div className="shell">
          <div className="relative mx-auto max-w-[54rem]">
            {/* Desk props beside the note: a ball of butter yarn with the hook resting on it. */}
            <CrochetHook className="absolute top-20 -left-1 hidden h-60 w-7 -rotate-[14deg] md:block lg:-left-9" />
            <YarnBall tone="butter" spin={false} className="absolute bottom-4 -left-8 hidden w-28 md:block lg:-left-20 lg:w-32" />

            <Reveal kind="drop" data-placeholder="maker-note" className="relative mx-auto max-w-2xl">
              <div className="relative -rotate-1 rounded-[6px] bg-paper px-6 pt-12 pb-11 shadow-lift sm:px-12 sm:pt-14 sm:pb-12">
                <span aria-hidden className="tape-strip absolute -top-3.5 left-8 h-7 w-28 -rotate-[5deg] sm:left-12" />
                <span aria-hidden className="tape-strip absolute -top-3 right-10 h-7 w-24 rotate-[6deg] sm:right-14" />

                <h2 className="font-display text-[clamp(2.75rem,7vw,5rem)]">Hi, I&apos;m the maker</h2>
                <p className="mt-6 max-w-[44ch] text-lg leading-relaxed text-brown">
                  Every FuzzBall starts as a loop on my hook. If you can&apos;t find what you&apos;re after, tell me. I&apos;d love to make it for you.
                </p>
                <Button asChild size="lg" variant="tape" className="mt-8">
                  <a href={waGeneral()} target="_blank" rel="noopener noreferrer">
                    Say hi on WhatsApp
                  </a>
                </Button>

                {/* The FF badge, stuck on the corner like a sticker. */}
                {/* eslint-disable-next-line @next/next/no-img-element -- small decorative brand mark; next/image adds nothing here. */}
                <img
                  src="/brand/logo-mark-circle.png"
                  alt=""
                  aria-hidden
                  className="absolute -right-2 -bottom-7 size-16 rotate-[10deg] object-contain drop-shadow-[0_4px_6px_rgb(63_38_25/0.22)] sm:-right-7 sm:-bottom-8 sm:size-24"
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section aria-labelledby="ig-h" className="pb-[clamp(4rem,9vw,7rem)]">
        <div className="shell">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="ig-h" className="font-display text-[clamp(2rem,4vw,3rem)]">
              See what&apos;s on the hook
            </h2>
            <a href={SITE.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-cocoa underline">
              Follow along on Instagram
            </a>
          </div>

          {/* Photos pegged to a sagging line. Phones scroll along the line; wider screens see all six. */}
          <div className="-mx-4 mt-6 snap-x snap-mandatory overflow-x-auto scroll-px-4 px-4 pt-2 pb-8 md:mx-0 md:overflow-visible md:px-0">
            <ul data-placeholder="instagram" className="relative flex w-max items-start gap-4 md:w-full md:justify-between md:gap-0">
              <svg aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-10 w-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none" fill="none">
                <path d="M0 4Q50 40 100 4" stroke="#a8804f" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              {tiles.map((p, i) => (
                <Reveal
                  as="li"
                  key={p.id}
                  delay={i * 40}
                  className="relative w-[42vw] max-w-[190px] shrink-0 snap-start md:w-[15%] md:max-w-none"
                  style={{ marginTop: `${sag(i) - 4}px` }}
                >
                  <a
                    href={SITE.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Open Instagram: ${p.name}`}
                    className="hang-photo group block pt-3"
                    style={{ ["--tilt" as string]: `${TILT[i % TILT.length]}deg` } as CSSProperties}
                  >
                    <span aria-hidden className="peg absolute top-0 left-1/2 z-10 -translate-x-1/2" />
                    <span className="block rounded-[4px] bg-paper p-1.5 pb-5 shadow-ticket">
                      <span className="relative block aspect-square overflow-hidden rounded-[2px] bg-kraft-light">
                        <Image src={p.images[0].src} alt="" fill sizes="(min-width:768px) 15vw, 42vw" className="object-cover" />
                      </span>
                    </span>
                  </a>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}
