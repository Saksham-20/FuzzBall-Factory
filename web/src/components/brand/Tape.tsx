import { cn } from "@/lib/cn";
import { TapeToggle } from "@/components/brand/TapeToggle";

/** Small yarn-ball glyph used as a separator. */
function Glyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#c98586" stroke="#3f2619" strokeWidth="1.6" />
      <path d="M4 9 Q12 15 20 8 M5 15 Q12 20 19 14 M8 3.5 Q13 12 9 21" fill="none" stroke="#3f2619" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  items: readonly string[];
  className?: string;
  /** The tape only decorates here: screen readers skip its words, and its pause button stays reachable. */
  decorative?: boolean;
}

/** Butter marquee strip. Holds still under the pointer, stops with its pause button, static under reduced motion. */
export function Tape({ items, className, decorative = false }: Props) {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-6 pr-6" aria-hidden={hidden || undefined}>
      {items.map((t) => (
        <li key={t} className="flex items-center gap-6">
          <span className="font-stencil text-[15px] whitespace-nowrap">{t}</span>
          <Glyph />
        </li>
      ))}
    </ul>
  );
  return (
    <div className={cn("overflow-hidden", className)}>
      <div className="tape relative -mx-4 -rotate-[1.2deg] bg-butter py-2.5 text-cocoa shadow-[0_2px_0_rgb(63_38_25/0.08)]">
        {/* The pause button rides the tape at the page's content edge, clear of the WhatsApp button on
            the right, and the words slide under a butter patch around it. Gone where the tape can't move. */}
        <div className="pointer-events-none absolute inset-y-0 right-4 left-4 z-10 motion-reduce:hidden">
          <div className="shell flex h-full">
            <div className="-ml-4 flex">
              <span className="w-3 bg-linear-to-l from-butter" />
              <span className="grid place-items-center bg-butter px-1">
                <TapeToggle />
              </span>
              <span className="w-3 bg-linear-to-r from-butter" />
            </div>
          </div>
        </div>
        <div className="tape-track flex w-max">
          {row(decorative)}
          {row(true)}
        </div>
      </div>
    </div>
  );
}
