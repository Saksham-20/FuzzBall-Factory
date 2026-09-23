import { cn } from "@/lib/cn";

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

interface Props {
  tone?: YarnTone;
  spin?: boolean;
  /** Renders an invisible anchor at the loose end so the conveyor thread can start there. */
  tailAnchor?: boolean;
  className?: string;
  title?: string;
}

/**
 * Flat yarn ball built from geometry only (circle + wrap arcs), following the
 * construction of the brand mark. The wraps rock gently inside a fixed clip.
 */
export function YarnBall({ tone = "rose", spin = true, tailAnchor, className, title }: Props) {
  const c = TONES[tone];
  const id = `ball-${tone}`;
  // Wraps meridians around one axis, like thread wound on a centre-pull ball.
  const N = 10;
  const wraps = Array.from({ length: N - 1 }, (_, i) => 190 * ((i + 1) / N));
  return (
    <div className={cn("relative aspect-square", className)}>
      <svg viewBox="0 0 400 400" className="size-full" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
        <defs>
          <clipPath id={id}>
            <circle cx="200" cy="200" r="190" />
          </clipPath>
        </defs>
        <circle cx="200" cy="200" r="190" fill={c.base} />
        <g clipPath={`url(#${id})`}>
          <g className={spin ? "ball-wraps" : undefined}>
            <g transform="rotate(28 200 200)" fill="none">
              {wraps.map((rx) => (
                <g key={rx}>
                  <ellipse cx="200" cy="200" rx={rx} ry="190" stroke={c.dark} strokeWidth="8" />
                  <ellipse cx="200" cy="200" rx={rx - 9} ry="190" stroke={c.light} strokeWidth="4" opacity="0.9" />
                </g>
              ))}
            </g>
          </g>
          {/* flat form shadow, no gradient */}
          <path
            fillRule="evenodd"
            fill={c.dark}
            opacity="0.2"
            d="M 200 10 a 190 190 0 1 0 0 380 a 190 190 0 1 0 0 -380 Z M 168 -14 a 200 200 0 1 1 0 400 a 200 200 0 1 1 0 -400 Z"
          />
        </g>
        <circle cx="200" cy="200" r="190" fill="none" stroke={c.dark} strokeWidth="5" />
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
