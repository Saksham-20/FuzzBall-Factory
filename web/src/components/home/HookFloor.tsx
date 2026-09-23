import Image from "next/image";
import { Ticket } from "@/components/brand/Ticket";
import { Reveal } from "@/components/ui/Reveal";
import { StationSection } from "@/components/home/StationSection";

/** The crochet chain stitch, drawn as linked ovals. */
function Chain() {
  return (
    <svg viewBox="0 0 120 20" className="h-5 w-[120px]" aria-hidden fill="none" stroke="#3f2619" strokeWidth="2.2">
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={i} cx={14 + i * 23} cy="10" rx="11" ry="6" />
      ))}
    </svg>
  );
}

/** PLACEHOLDER(copy-process): confirm the making process wording with the maker. */
const STEPS = [
  { t: "Pick the yarn", d: "Fiber and colour are chosen for the piece: soft milk cotton for plushies, sturdy cotton for bags." },
  { t: "Hook, row by row", d: "Every stitch is worked by hand, one loop at a time." },
  { t: "Stuff, finish, pack", d: "Stuffed, sewn up, checked and packed to travel." },
] as const;

/** PLACEHOLDER(copy-leadtimes): sample lead times; the real ones live on each product. */
export function HookFloor() {
  return (
    <StationSection id="hook-floor" n="02" name="Hook Floor">
      <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <div>
          <Reveal as="h2" className="font-display text-[clamp(2.5rem,5.6vw,4.5rem)]">
            Made by one pair of hands
          </Reveal>

          <ol className="mt-9 grid gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.t} delay={i * 70}>
                <Chain />
                <h3 className="mt-3 text-lg font-bold">{s.t}</h3>
                <p className="mt-1 leading-relaxed text-brown">{s.d}</p>
              </Reveal>
            ))}
          </ol>

          <Reveal data-placeholder="copy-leadtimes" className="relative mt-14">
            <h3 className="text-lg font-bold">How long until it leaves?</h3>
            <p className="mt-1 max-w-[52ch] leading-relaxed text-brown">
              Ready-to-ship pieces are already made. Made-to-order pieces are crocheted after you order, so they take longer. The exact
              time is on every product.
            </p>
            <div className="mt-6 grid grid-cols-10 gap-y-2 text-sm" role="img" aria-label="Ready to ship leaves in 1 to 2 days. Made to order leaves in 4 to 10 days.">
              <p className="col-span-10 font-semibold">
                Ready to ship <span className="font-normal text-brown">· 1–2 days</span>
              </p>
              <div className="col-span-2 h-3.5 rounded-full bg-butter" />
              <p className="col-span-10 mt-3 font-semibold">
                Made to order <span className="font-normal text-brown">· 4–10 days</span>
              </p>
              <div className="col-[4/span_7] h-3.5 rounded-full bg-kraft-deep" />
              <div aria-hidden className="col-span-10 mt-2 grid grid-cols-10 border-t border-line-strong">
                {Array.from({ length: 10 }, (_, d) => (
                  <span key={d} className="font-stencil tabular border-l border-line-strong pt-1 pl-1 text-[12px] text-brown-soft first:border-l-0">
                    {d + 1}
                  </span>
                ))}
              </div>
              <p className="col-span-10 text-xs text-brown-soft">Days after you order</p>
            </div>
          </Reveal>
        </div>

        <Reveal kind="drop" className="mx-auto w-full max-w-[380px] lg:sticky lg:top-28 lg:mx-0">
          <Ticket data-placeholder="sample-photo" head={["Hook Floor", "Close-up"]} className="rotate-2">
            <div className="relative aspect-[3/4] overflow-hidden rounded-[10px]">
              <Image
                src="/samples/flower-single.jpg"
                alt="Close-up of crochet stitches with a pink flower"
                fill
                sizes="(min-width:1024px) 30vw, 80vw"
                className="object-cover"
              />
            </div>
            <p className="px-1 pt-3 pb-1 text-sm text-brown">Sample photo. Your stitches go here.</p>
          </Ticket>
        </Reveal>
      </div>
    </StationSection>
  );
}
