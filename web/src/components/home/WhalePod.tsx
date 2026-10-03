import Link from "next/link";
import { Ticket } from "@/components/brand/Ticket";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { ClipRelay, LoopClip } from "@/components/home/LoopClip";
import { StationSection } from "@/components/home/StationSection";
import { serverProducts } from "@/lib/catalog-server";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";
import { SITE } from "@/lib/site";
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
 * Station 01, the shelf: the whale keychains, one clip per colour from the maker's own footage, played one at a time.
 * (The pod's still is the hero's ticket, so it isn't repeated here.) Until a whale is listed in the shop, the buttons
 * lead to a work order and WhatsApp (never to an empty shelf, never to a made-up price); once a keychain is published
 * its card links to it, with its price, and the primary button opens the shelf.
 */
export async function WhalePod() {
  const keychains = await serverProducts({ category: "keychains" });
  const listed = keychains.length > 0;
  return (
    <StationSection id="shelf" n="01" name="The Shelf" headingId="pod-h">
      <h2 id="pod-h" className="scroll-mt-28 font-display text-[clamp(2.5rem,5.6vw,4.5rem)]">
        Meet the whales
      </h2>
      <p className="mt-5 max-w-[52ch] text-lg leading-relaxed text-brown">
        Pocket-sized whale keychains, crocheted by hand with a white belly and a gold clasp. Clip one to your keys, a bag or a zip.
      </p>

      <ClipRelay>
        <ul className="mt-9 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {WHALES.map((w, i) => (
            <li key={w.key}>
              <Reveal kind="drop" delay={i * 70}>
                <WhaleCard whale={w} product={listingFor(keychains, w.key)} />
              </Reveal>
            </li>
          ))}
        </ul>
      </ClipRelay>

      <Reveal delay={80} className="mt-9 flex flex-wrap items-center gap-3">
        {listed ? (
          <>
            <Button asChild size="lg">
              <Link href="/shop/keychains">Shop keychains</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/custom?idea=whale">Ask for another colour</Link>
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
      </Reveal>
    </StationSection>
  );
}

/**
 * A whale's ticket. Once it is listed, the name in the head links to the listing and stretches over the whole card, as on
 * the shop's tickets (lifted above the clip, which comes later in the page); the clip's button sits above that link.
 * Unlisted, the card is only a clip: it neither lifts nor links, since there is nothing to open yet.
 */
function WhaleCard({ whale: w, product: p }: { whale: (typeof WHALES)[number]; product: Product | null }) {
  const sample = SITE.useMock && p?.sample;
  const soldOut = p ? p.variants.every((v) => v.stock === 0) : false;
  return (
    <Ticket
      tone="paper"
      compactHead
      data-placeholder={sample ? "sample-product" : undefined}
      head={[
        p ? (
          <Link
            href={`/p/${p.slug}`}
            aria-label={`${w.name} whale keychain`}
            className="rounded-sm after:absolute after:inset-0 after:z-[1] after:content-[''] focus-visible:outline-offset-4"
          >
            {w.name}
          </Link>
        ) : (
          w.name
        ),
        "Whale",
      ]}
      className={cn(p && "transition-[translate,box-shadow] duration-300 ease-out hf:hover:-translate-y-1.5 hf:hover:shadow-lift")}
      style={{ rotate: `${w.tilt}deg` }}
    >
      <LoopClip
        src={`/maker/clips/whale-${w.key}.mp4`}
        poster={`/maker/clips/whale-${w.key}.jpg`}
        label={`${w.name} whale keychain turning in a hand`}
        className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-kraft-light"
      >
        {sample ? (
          <Badge tone="sample" className="absolute top-2 left-2">
            Sample
          </Badge>
        ) : null}
      </LoopClip>
      {/* Status sits under the clip, not on it: two to a row on a phone, a badge on the clip ran into its button. */}
      {p ? (
        <p className="flex flex-wrap items-baseline justify-between gap-x-2 px-1 pt-2.5 pb-1">
          <span className="tabular text-[15px] font-semibold text-brown">{formatINR(p.price)}</span>
          <span className="font-stencil text-[13px] text-brown-soft">{soldOut ? "Sold out" : p.fulfilment === "READY" ? "Ready to ship" : "Made to order"}</span>
        </p>
      ) : null}
    </Ticket>
  );
}
