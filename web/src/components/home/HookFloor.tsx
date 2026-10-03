import { Fragment } from "react";
import Image from "next/image";
import { Stamp } from "@/components/brand/Stamp";
import { Ticket } from "@/components/brand/Ticket";
import { Reveal } from "@/components/ui/Reveal";
import { StationSection } from "@/components/home/StationSection";
import { cn } from "@/lib/cn";
import { DOMESTIC_TRANSIT_DAYS } from "@/lib/pricing";
import { SITE } from "@/lib/site";

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

/**
 * PLACEHOLDER(copy-leadtimes): sample making times; the real ones live on each product. Arrival adds the transit days
 * inside India that checkout also quotes (DOMESTIC_TRANSIT_DAYS).
 */
const LEADS = [
  { name: "Ready to ship", leaves: [1, 2], tone: "bg-butter" },
  { name: "Made to order", leaves: [4, 10], tone: "bg-kraft-deep" },
] as const;
const arrives = ([a, b]: readonly [number, number]) => [a + DOMESTIC_TRANSIT_DAYS[0], b + DOMESTIC_TRANSIT_DAYS[1]] as const;
const DAYS = Math.max(...LEADS.map((l) => arrives(l.leaves)[1]));
const cols = { gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))` };

/** When a piece reaches you, drawn on a ruler of days: one bar per kind of piece, spanning its arrival window. */
function ArrivalRuler() {
  const label = LEADS.map((l) => {
    const [a, b] = arrives(l.leaves);
    return `${l.name} arrives ${a} to ${b} days after you order.`;
  }).join(" ");
  return (
    <Reveal data-placeholder="copy-leadtimes" className="relative mt-14">
      <h3 className="text-lg font-bold">How long until it reaches you?</h3>
      <p className="mt-1 max-w-[52ch] leading-relaxed text-brown">
        Ready-to-ship pieces are already made. Made-to-order pieces are crocheted after you order, so they take longer. Check
        your pincode on any piece for its own date.
      </p>
      <div className="mt-6 grid gap-y-2 text-sm" style={cols} role="img" aria-label={label}>
        {LEADS.map((l, i) => {
          const [a, b] = arrives(l.leaves);
          return (
            <Fragment key={l.name}>
              <p className={cn("col-span-full font-semibold", i > 0 && "mt-3")}>
                {l.name}{" "}
                <span className="font-normal text-brown">
                  · leaves in {l.leaves[0]}–{l.leaves[1]} days, arrives in {a}–{b}
                </span>
              </p>
              <div
                className={cn("grow-bar h-3.5 rounded-full", l.tone)}
                style={{ gridColumn: `${a} / ${b + 1}`, ["--gd" as string]: `${220 + i * 160}ms` }}
              />
            </Fragment>
          );
        })}
        <div aria-hidden className="col-span-full mt-2 grid border-t border-line-strong" style={cols}>
          {Array.from({ length: DAYS }, (_, d) => (
            <span key={d} className="font-stencil tabular border-l border-line-strong pt-1 pl-0.5 text-[12px] text-brown-soft first:border-l-0">
              {(d + 1) % 2 === 0 ? d + 1 : ""}
            </span>
          ))}
        </div>
        <p className="col-span-full text-xs text-brown-soft">Days after you order</p>
      </div>
    </Reveal>
  );
}

/**
 * Station 02: who makes it and how. The maker's note and the stall where the whales sold out (the proof, now near the
 * top of the page instead of after everything else), the three steps, and when a piece arrives. On phones the photo
 * follows the note it belongs to; from lg it stands beside the column, sticky while the steps go by.
 */
export function HookFloor() {
  return (
    <StationSection id="hook-floor" n="02" name="Hook Floor" headingId="hook-floor-h">
      <div className="grid items-start gap-y-12 lg:split-text lg:gap-x-16">
        <div className="lg:col-start-1">
          <h2 id="hook-floor-h" className="font-display text-[clamp(2.5rem,5.6vw,4.5rem)]">
            Made by one pair of hands
          </h2>
          {/* PLACEHOLDER(maker-note): the maker's name and own words replace this copy (the stall photo is real). */}
          <Reveal data-placeholder="maker-note" className="relative mt-8">
            <div className="relative -rotate-1 rounded-[6px] bg-paper px-6 pt-9 pb-6 shadow-lift sm:px-9">
              <span aria-hidden className="tape-strip absolute -top-3 left-8 h-6 w-24 -rotate-[5deg]" />
              <p className="text-lg leading-relaxed text-brown">
                Hi, I&apos;m the maker. That&apos;s me at our stall at ISB, where we sold out. Every FuzzBall starts as a loop on my
                hook. If you can&apos;t find what you&apos;re after, tell me. I&apos;d love to make it for you.
              </p>
              <a
                href={SITE.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-11 items-center font-semibold text-cocoa underline underline-offset-4"
              >
                Follow along on Instagram
              </a>
            </div>
          </Reveal>
        </div>

        <figure className="relative mx-auto mb-10 w-full max-w-[380px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:top-28 lg-tall:sticky">
          {/* The stamp lands on the ticket's corner once the ticket has dropped in; its paper ground keeps the ink
              readable over the photo's edge. The figure's bottom margin is the stamp's room (it hangs below the
              ticket), so it never meets the steps' rule on a phone or the band's edge while the ticket sticks. */}
          <Reveal kind="drop">
            <Ticket head={["Our stall", "ISB"]} className="rotate-2">
              <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-kraft-light">
                <Image
                  src="/maker/founder-isb-stall.jpg"
                  alt="The maker smiling and making a peace sign at our ISB stall, with a crochet scarf, a hedgehog and a scrunchie on the table and a sold out sign taped to the front"
                  fill
                  sizes="(min-width: 1024px) 380px, 80vw"
                  className="origin-[36%_52%] scale-[1.18] object-cover"
                />
              </div>
              <figcaption className="px-1 pt-3 pb-1 text-sm text-brown">Our table at ISB. The sign says it all.</figcaption>
            </Ticket>
            <span className="stamp-seq absolute -bottom-9 -left-2 md:-left-7" style={{ ["--sd" as string]: "640ms" }}>
              <Stamp label="Sold out" shape="ticket" rotate={-7} className="bg-paper shadow-ticket" />
            </span>
          </Reveal>
        </figure>

        <div className="lg:col-start-1">
          <ol className="divide-y divide-line border-y border-line">
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
          <ArrivalRuler />
        </div>
      </div>
    </StationSection>
  );
}
