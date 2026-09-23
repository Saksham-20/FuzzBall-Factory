import { cn } from "@/lib/cn";

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
}

/** Butter marquee strip. Paused on hover; static under reduced motion. */
export function Tape({ items, className }: Props) {
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
      <div className="tape -mx-4 -rotate-[1.2deg] bg-butter py-2.5 text-cocoa shadow-[0_2px_0_rgb(63_38_25/0.08)]">
        <div className="tape-track flex w-max">
          {row(false)}
          {row(true)}
        </div>
      </div>
    </div>
  );
}
