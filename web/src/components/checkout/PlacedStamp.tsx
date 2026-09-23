import { Stamp, type StampShape, type StampTone } from "@/components/brand/Stamp";
import { cn } from "@/lib/cn";

interface Props {
  label: string;
  tone?: StampTone;
  shape?: StampShape;
  rotate?: number;
  /** Play the stamp-down once. Off under reduced motion via CSS. */
  animate?: boolean;
  className?: string;
}

/** A big rubber stamp that lands once (scale 1.15 to 1 with a rotation settle, 260ms). */
export function BigStamp({ label, tone = "ink", shape = "rect", rotate = -6, animate, className }: Props) {
  return (
    <span className={cn("inline-block", animate && "stamp-down")}>
      <Stamp label={label} tone={tone} shape={shape} rotate={rotate} className={cn("px-6 py-3 text-2xl sm:px-8 sm:py-4 sm:text-3xl", className)} />
    </span>
  );
}
