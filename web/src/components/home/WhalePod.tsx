import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { LoopClip } from "@/components/home/LoopClip";
import { serverProducts } from "@/lib/catalog-server";
import { waGeneral } from "@/lib/whatsapp";
import type { Product } from "@/lib/types";

const WHALES = [
  { key: "red", name: "Red", tilt: -1.5 },
  { key: "yellow", name: "Yellow", tilt: 1 },
  { key: "blue", name: "Blue", tilt: 1.5 },
  { key: "pink", name: "Pink", tilt: -1 },
] as const;

/** The listing for a whale colour: a published keychain with a variant or swatch in that colour (null until it exists). */
const listingFor = (products: Product[], colour: string) =>
  products.find((p) => p.variants.some((v) => v.colour.toLowerCase().split(/\W+/).includes(colour)) || p.slug.split("-").includes(colour)) ?? null;

/**
 * The whale keychains, from the maker's own photo and clips: one still of the pod, one loop per colour. Until a whale is
 * listed in the shop, the buttons lead to a work order and WhatsApp (never to an empty shelf, never to a made-up price);
 * once a keychain is published each card gets a link to it and the primary button opens the shelf.
 */
export async function WhalePod() {
  const keychains = await serverProducts({ category: "keychains" });
  const listed = keychains.length > 0;
  return (
    <section aria-labelledby="pod-h" className="relative overflow-x-clip py-[clamp(3.5rem,7vw,6rem)]">
      <div className="shell">
        <div className="conveyor-indent grid items-start gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
          <Reveal kind="drop" className="mx-auto w-full max-w-[380px] lg:top-28 lg:mx-0 lg-tall:sticky">
            <Ticket head={["Batch #002", "Whale keychains"]} className="-rotate-2">
              <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-kraft-light">
                <Image
                  src="/maker/whale-pod.jpg"
                  alt="A hand holding four crochet whale keychains by their gold clasps: pink, red, blue and yellow, each with a white belly"
                  fill
                  sizes="(min-width:1024px) 30vw, 80vw"
                  className="object-cover"
                />
              </div>
              <p className="px-1 pt-3 pb-1 text-sm text-brown">The whole pod, hanging by its clasps.</p>
            </Ticket>
          </Reveal>

          <div>
            <Reveal as="h2" id="pod-h" className="scroll-mt-28 font-display text-[clamp(2.5rem,5.6vw,4.5rem)]">
              Meet the whales
            </Reveal>
            <Reveal as="p" delay={60} className="mt-5 max-w-[52ch] text-lg leading-relaxed text-brown">
              Pocket-sized whale keychains, crocheted by hand with a white belly and a gold clasp. Clip one to your keys, a bag or a zip.
            </Reveal>

            <ul className="mt-9 grid grid-cols-2 gap-4 sm:gap-6">
              {WHALES.map((w, i) => (
                <li key={w.key}>
                  <Reveal kind="drop" delay={(i % 2) * 70}>
                    <WhaleCard product={listingFor(keychains, w.key)} name={w.name}>
                      <Ticket tone="paper" compactHead head={[w.name, "Whale"]} className="transition-[translate,box-shadow] duration-300 ease-out hf:hover:-translate-y-1.5 hf:hover:shadow-lift" style={{ rotate: `${w.tilt}deg` }}>
                        <LoopClip
                          src={`/maker/clips/whale-${w.key}.mp4`}
                          poster={`/maker/clips/whale-${w.key}.jpg`}
                          label={`${w.name} whale keychain turning in a hand`}
                          className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-kraft-light"
                        />
                      </Ticket>
                    </WhaleCard>
                  </Reveal>
                </li>
              ))}
            </ul>

            <Reveal delay={80} className="mt-9 flex flex-wrap items-center gap-3">
              {listed ? (
                <>
                  <Button asChild size="lg">
                    <Link href="/shop/keychains">Shop keychains</Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <Link href="/custom">Ask for another colour</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg">
                    <Link href="/custom">Ask for a whale</Link>
                  </Button>
                  <Button asChild size="lg" variant="secondary">
                    <a href={waGeneral()} target="_blank" rel="noopener noreferrer">
                      Ask on WhatsApp
                    </a>
                  </Button>
                </>
              )}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Once a whale is listed the card gets a link to it under the clip. The link sits beside the clip, never around it: the clip holds its own play/pause button, and a button inside a link is not valid. */
function WhaleCard({ product, name, children }: { product: Product | null; name: string; children: ReactNode }) {
  return (
    <>
      {children}
      {product ? (
        <Link
          href={`/p/${product.slug}`}
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-cocoa underline underline-offset-4 decoration-brown-soft hf:hover:decoration-cocoa"
        >
          {name} whale: see the listing
        </Link>
      ) : null}
    </>
  );
}
