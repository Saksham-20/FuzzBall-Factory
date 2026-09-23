import { cn } from "@/lib/cn";

interface Props {
  className?: string;
  /** Draws a few turns of rose yarn around the shaft, like the brand mark. */
  wound?: boolean;
}

/**
 * Crochet hook, head up. The throat notch sits at about (27, 22) in the
 * 40×320 viewBox, which is the point the conveyor pins to the thread tip.
 */
export function CrochetHook({ className, wound = true }: Props) {
  return (
    <svg viewBox="0 0 40 320" className={cn("overflow-visible", className)} aria-hidden>
      {/* head with throat */}
      <path
        d="M13 66 V32 C13 15 22 5 31 5 C37.5 5 40 11 35.5 15.5 C32 19 27 20 27 29 V66 Z"
        fill="#6b4228"
      />
      {/* shaft */}
      <rect x="13" y="60" width="14" height="250" rx="7" fill="#6b4228" />
      {/* thumb rest */}
      <rect x="8" y="150" width="24" height="52" rx="11" fill="#8a6249" />
      {/* highlight */}
      <rect x="16.5" y="72" width="2.4" height="228" rx="1.2" fill="#a8804f" opacity="0.7" />
      {wound ? (
        <g fill="none" stroke="#c98586" strokeWidth="3" strokeLinecap="round">
          <ellipse cx="20" cy="86" rx="9.5" ry="3" />
          <ellipse cx="20" cy="94" rx="9.5" ry="3" />
          <ellipse cx="20" cy="102" rx="9.5" ry="3" />
        </g>
      ) : null}
    </svg>
  );
}
