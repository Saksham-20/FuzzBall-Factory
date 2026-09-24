import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductTicket } from "@/components/store/ProductTicket";
import { Reveal } from "@/components/ui/Reveal";
import { StationSection } from "@/components/home/StationSection";
import { categories, lowestPrice, products, productsIn } from "@/lib/mock/catalog";
import { formatINR } from "@/lib/format";

/**
 * Modak's average advance per letter, in em: door words are sized from their length alone.
 * Wide letters run over it (m ≈ 0.84em, w ≈ 0.76em), so a longest word heavy in them can slide
 * under its chip. Measure the rendered word instead once category words come from the admin.
 */
const MODAK_EM_PER_LETTER = 0.56;

export function Shelf() {
  const doors = categories
    .map((c) => ({ c, list: productsIn(c.slug) }))
    .filter((d) => d.list.length > 0);
  // Every door word shares one size: the widest word fills its row.
  const doorEm = (Math.max(...doors.map((d) => d.c.word.length)) * MODAK_EM_PER_LETTER).toFixed(2);
  const fresh = [...products]
    .filter((p) => p.variants.some((v) => v.stock > 0))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  return (
    <StationSection id="shelf" n="03" name="The Shelf">
      <Reveal as="h2" className="font-display text-[clamp(2.5rem,5.6vw,4.5rem)]">
        The shelf
      </Reveal>

      <nav aria-label="Shop by category" className="mt-8 border-b border-line">
        {doors.map(({ c, list }, i) => (
          <Reveal key={c.slug} delay={i * 40}>
            <Link
              href={`/shop/${c.slug}`}
              className="group relative flex items-center gap-2 overflow-hidden border-t border-line py-1.5 outline-offset-[-4px] sm:gap-3 md:py-1"
            >
              <span className="@container min-w-0 flex-1">
                {/* The class is the fallback size: a browser without container units drops the inline
                    value at parse time (it holds no var(), which would defer that and lose both). */}
                <span
                  className="font-display block text-[clamp(3.75rem,14.5vw,11.5rem)] leading-[0.86] whitespace-nowrap text-cocoa transition-transform duration-300 ease-out hf:group-hover:translate-x-3"
                  style={{ fontSize: `min(11.5rem, calc(100cqi / ${doorEm}))` }}
                >
                  {c.word}
                </span>
              </span>
              <span
                aria-hidden
                className={`pointer-events-none absolute top-1/2 right-24 hidden h-[72%] w-[clamp(120px,14vw,190px)] -translate-y-1/2 translate-x-6 rotate-3 overflow-hidden rounded-[10px] opacity-0 shadow-lift transition-[opacity,transform] duration-300 ease-out md:block hf:group-hover:translate-x-0 hf:group-hover:opacity-100`}
              >
                <Image src={c.image} alt="" fill sizes="190px" className="object-cover" />
              </span>
              <span className="font-stencil tabular relative z-10 mr-2 flex min-w-[3.25rem] shrink-0 items-center justify-between gap-2 rounded-full bg-butter px-3.5 py-2 text-[12px] text-cocoa ring-4 ring-cream sm:min-w-[12rem] md:mr-3 md:px-4">
                <span className="hidden sm:inline">
                  {list.length} {list.length === 1 ? "piece" : "pieces"} · from {formatINR(lowestPrice(list))}
                </span>
                <span className="sm:hidden">{list.length}</span>
                <ArrowRight className="size-4" />
              </span>
              <span className="sr-only">
                {c.name}: {c.blurb}
              </span>
            </Link>
          </Reveal>
        ))}
      </nav>

      <div className="mt-20 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <Reveal as="h3" className="font-display text-[clamp(2rem,4vw,3rem)]">
          Fresh off the line
        </Reveal>
        <Link href="/shop" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-cocoa underline">
          See the whole shelf <ArrowRight className="size-4" />
        </Link>
      </div>

      <ul className="-mx-4 mt-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-4">
        {fresh.map((p, i) => (
          <li key={p.id} className="w-[68vw] max-w-[300px] shrink-0 snap-start md:w-auto md:max-w-none">
            <Reveal delay={(i % 4) * 60}>
              <ProductTicket product={p} priority={false} />
            </Reveal>
          </li>
        ))}
      </ul>
    </StationSection>
  );
}
