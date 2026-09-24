import Image from "next/image";
import { Ticket } from "@/components/brand/Ticket";
import { Reveal } from "@/components/ui/Reveal";
import { StationSection } from "@/components/home/StationSection";

type ThreadState = "loose" | "working" | "done";

const LINKS = [14, 31, 48, 65, 82];

/**
 * Thread state by stroke, the same language as order status: a loose end
 * (waiting), a chain whose next stitches are still dashed with the hook in the
 * last loop (in progress), and a chain tied off with a knot (done).
 */
function StitchGlyph({ state }: { state: ThreadState }) {
  return (
    <svg
      viewBox="0 0 136 44"
      className="stitch-draw h-11 w-[136px]"
      aria-hidden
      fill="none"
      stroke="#3f2619"
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      {state === "loose" ? (
        <>
          <circle cx="16" cy="22" r="12" />
          <path d="M6.5 16.5Q16 24 26.5 15.5M5 24.5Q16 32 27.5 23.5M13 10.5Q21 22 13 33.5" strokeWidth="1.6" />
          <path d="M27 27C44 35 58 14 76 21S101 31 108 22C112 16.5 105 12 100.5 17.5" />
        </>
      ) : (
        <>
          {LINKS.map((cx, i) => (
            <ellipse
              key={cx}
              cx={cx}
              cy="22"
              rx="9"
              ry="5.5"
              strokeDasharray={state === "working" && i >= 3 ? "3.2 3.2" : undefined}
            />
          ))}
          {state === "working" ? (
            <path d="M128 40L97 21.5C94.5 20 94.5 16.5 97.5 15.5" stroke="#6b4228" strokeWidth="4" />
          ) : (
            <>
              <circle cx="96.5" cy="22" r="3.6" fill="#3f2619" stroke="none" />
              <path d="M100 23.5C108 27 113 19.5 121 23.5" />
            </>
          )}
        </>
      )}
    </svg>
  );
}

/** PLACEHOLDER(copy-process): confirm the making process wording with the maker. */
const STEPS: { t: string; d: string; state: ThreadState; tag: string }[] = [
  {
    t: "Pick the yarn",
    d: "Fiber and colour are chosen for the piece: soft milk cotton for plushies, sturdy cotton for bags.",
    state: "loose",
    tag: "Loose end",
  },
  { t: "Hook, row by row", d: "Every stitch is worked by hand, one loop at a time.", state: "working", tag: "On the hook" },
  { t: "Stuff, finish, pack", d: "Stuffed, sewn up, checked and packed to travel.", state: "done", tag: "Tied off" },
];

/** PLACEHOLDER(copy-leadtimes): sample lead times; the real ones live on each product. */
export function HookFloor() {
  return (
    <StationSection id="hook-floor" n="02" name="Hook Floor">
      <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        <div>
          <Reveal as="h2" className="font-display text-[clamp(2.5rem,5.6vw,4.5rem)]">
            Made by one pair of hands
          </Reveal>

          <ol className="mt-9 divide-y divide-line border-y border-line">
            {STEPS.map((s, i) => (
              <Reveal
                as="li"
                key={s.t}
                delay={i * 90}
                className="grid gap-x-6 gap-y-2 py-5 sm:grid-cols-[8.5rem_1fr] sm:items-center"
              >
                {/* On phones the tag sits beside its glyph, as the glyph's caption: stacked above the
                    step's heading it read as an eyebrow label. */}
                <div className="flex items-center gap-3 sm:block">
                  <StitchGlyph state={s.state} />
                  <p className="font-stencil text-[12px] text-brown-soft sm:mt-1">{s.tag}</p>
                </div>
                <div>
                  <h3 className="text-lg font-bold">{s.t}</h3>
                  <p className="mt-1 leading-relaxed text-brown">{s.d}</p>
                </div>
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
              <div className="grow-bar col-span-2 h-3.5 rounded-full bg-butter" />
              <p className="col-span-10 mt-3 font-semibold">
                Made to order <span className="font-normal text-brown">· 4–10 days</span>
              </p>
              <div className="grow-bar col-[4/span_7] h-3.5 rounded-full bg-kraft-deep" style={{ ["--gd" as string]: "380ms" }} />
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

        <Reveal kind="drop" className="mx-auto w-full max-w-[380px] lg:top-28 lg:mx-0 lg-tall:sticky">
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
