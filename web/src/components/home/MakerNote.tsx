import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { products } from "@/lib/mock/catalog";
import { SITE } from "@/lib/site";
import { waGeneral } from "@/lib/whatsapp";

const tiles = [products[0], products[2], products[1], products[3], products[5], products[6]];

/** PLACEHOLDER(maker-note): the maker's name, photo and own words replace this copy. */
export function MakerNote() {
  return (
    <>
      <section className="py-[clamp(4rem,9vw,7rem)]">
        <div className="shell">
          <Reveal data-placeholder="maker-note" className="relative mx-auto max-w-3xl text-center">
            <h2 className="font-display text-[clamp(2.75rem,7vw,5.5rem)]">Hi, I&apos;m the maker</h2>
            <p className="mx-auto mt-6 max-w-[54ch] text-lg leading-relaxed text-brown">
              Every FuzzBall starts as a loop on my hook. If you can&apos;t find what you&apos;re after, tell me. I&apos;d love to make it for you.
            </p>
            <Button asChild size="lg" variant="tape" className="mt-8">
              <a href={waGeneral()} target="_blank" rel="noopener noreferrer">
                Say hi on WhatsApp
              </a>
            </Button>
          </Reveal>
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
          <ul data-placeholder="instagram" className="relative mt-6 grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
            {tiles.map((p, i) => (
              <Reveal as="li" key={p.id} delay={i * 40} className="relative aspect-square overflow-hidden rounded-[12px] bg-kraft-light">
                <a href={SITE.instagram} target="_blank" rel="noopener noreferrer" aria-label={`Open Instagram: ${p.name}`} className="absolute inset-0 block">
                  <Image src={p.images[0].src} alt="" fill sizes="(min-width:768px) 16vw, 33vw" className="object-cover transition-transform duration-300 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105" />
                </a>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
