import { cn } from "@/lib/cn";

export type StampTone = "ink" | "ok" | "warn" | "err" | "live";
export type StampShape = "circle" | "rect" | "ticket";

const TONE: Record<StampTone, string> = {
  ink: "text-cocoa",
  ok: "text-ok",
  warn: "text-warn",
  err: "text-err",
  live: "text-rose-deep",
};

interface Props {
  label: string;
  tone?: StampTone;
  /** Shape differs per status family so colour is never the only signal. */
  shape?: StampShape;
  rotate?: number;
  className?: string;
}

/** Rubber-stamp status mark. Multiply blend lets the paper show through the ink. */
export function Stamp({ label, tone = "ink", shape = "rect", rotate = -4, className }: Props) {
  const base =
    "font-stencil inline-flex select-none items-center justify-center text-center leading-none mix-blend-multiply";
  const shapes: Record<StampShape, string> = {
    rect: "rounded-[6px] border-2 border-current px-3 py-1.5 text-[13px] outline outline-[1.5px] -outline-offset-[5px] outline-current",
    circle:
      "aspect-square size-[74px] rounded-full border-2 border-current px-2 text-[12px] outline outline-[1.5px] -outline-offset-[5px] outline-current",
    ticket:
      "rounded-[4px] border-2 border-dashed border-current px-3 py-1.5 text-[13px]",
  };
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(base, shapes[shape], TONE[tone], className)}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <span aria-hidden>{label}</span>
    </span>
  );
}
