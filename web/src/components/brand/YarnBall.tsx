import { cn } from "@/lib/cn";
import { FORM_SHADOW, WRAPS } from "@/components/brand/yarn-geometry";

const TONES = {
  rose: { base: "#c98586", dark: "#a95f62", light: "#e2acab" },
  butter: { base: "#f4cd52", dark: "#d9ab1f", light: "#fae08c" },
  kraft: { base: "#d4ae80", dark: "#a8804f", light: "#e8d3b4" },
  cocoa: { base: "#6b4228", dark: "#3f2619", light: "#8a6249" },
  cream: { base: "#f1e4d3", dark: "#d4ae80", light: "#fcf8f2" },
} as const;

export type YarnTone = keyof typeof TONES;

/** Where the loose thread leaves the ball, as a % of the ball box (angle 125°). */
export const YARN_TAIL = { x: 22.7, y: 89.5 } as const;

/** Mix two #rrggbb colours: `t` of the way from `a` to `b`. */
function mix(a: string, b: string, t: number) {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const out = [0, 1, 2].map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** Shades for any yarn colour: shadow mixed toward cocoa ink, highlight toward paper. */
const shadesOf = (hex: string) => ({ base: hex, dark: mix(hex, "#3f2619", 0.3), light: mix(hex, "#fcf8f2", 0.38) });

interface Props {
  tone?: YarnTone;
  /** Any yarn colour as #rrggbb, e.g. a fiber swatch. Overrides `tone`. */
  color?: string;
  spin?: boolean;
  /** Fewer, bolder strands so the ball still reads at swatch size (under ~64px). */
  small?: boolean;
  /** Renders an invisible anchor at the loose end so the conveyor thread can start there. */
  tailAnchor?: boolean;
  className?: string;
  title?: string;
}

/**
 * Flat yarn ball built from geometry only: three bands of wraps wound around
 * three axes, following the construction of the ball in the brand mark. The
 * wraps rock gently inside the round clip; that layer is an HTML box, so the
 * rocking stays on the compositor.
 */
export function YarnBall({ tone = "rose", color, spin = true, small, tailAnchor, className, title }: Props) {
  const c = color ? shadesOf(color) : TONES[tone];
  const w = WRAPS[small ? "low" : "full"];
  return (
    <div
      className={cn("relative aspect-square", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <div className="absolute inset-[2.5%] overflow-hidden rounded-full" style={{ backgroundColor: c.base }}>
        <svg
          viewBox="10 10 380 380"
          className={cn("absolute inset-0 size-full", spin && "ball-wraps")}
          fill="none"
          strokeLinecap="round"
        >
          {w.layers.map((l, i) => (
            <g key={i}>
              {l.shadow ? <path d={l.shadow} fill={c.dark} opacity={0.3} /> : null}
              {l.fill ? <path d={l.fill} fill={c.base} /> : null}
              {l.strands.map((d) => (
                <path key={d} d={d} stroke={c.dark} strokeWidth={w.stroke} />
              ))}
              {l.highlights.map((d) => (
                <path key={d} d={d} stroke={c.light} strokeWidth={w.highlight} opacity={0.9} />
              ))}
            </g>
          ))}
        </svg>
      </div>
      <svg viewBox="0 0 400 400" className="absolute inset-0 size-full">
        <path d={FORM_SHADOW} fill={c.dark} opacity={0.2} />
        <circle cx="200" cy="200" r="190" fill="none" stroke={c.dark} strokeWidth={small ? 9 : 5} />
      </svg>
      {tailAnchor ? (
        <span
          data-thread-start
          aria-hidden
          className="pointer-events-none absolute size-px"
          style={{ left: `${YARN_TAIL.x}%`, top: `${YARN_TAIL.y}%` }}
        />
      ) : null}
    </div>
  );
}
