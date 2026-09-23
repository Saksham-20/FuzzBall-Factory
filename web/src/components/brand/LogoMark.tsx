import { cn } from "@/lib/cn";

interface Props {
  className?: string;
  /** Sits on a small cream chip so the dark-ink wordmark stays legible on dark grounds (e.g. the footer). */
  invert?: boolean;
  /** The fuller lockup with the "Handmade with love" line, for spots with room to spare (the footer brand block). */
  full?: boolean;
}

/** The maker's own wordmark (public/brand/logo-wordmark*.png): FuzzBall Factory, with the yarn-and-hook heart above it. */
export function LogoMark({ className, invert, full }: Props) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element -- small inline mark used at many fixed sizes; next/image adds no benefit here.
    <img
      src={full ? "/brand/logo-wordmark-full.png" : "/brand/logo-wordmark.png"}
      alt="FuzzBall Factory, handmade with love"
      className={cn("w-auto object-contain", full ? "h-16" : "h-12")}
    />
  );
  if (!invert) return <span className={cn("inline-flex", className)}>{img}</span>;
  return (
    <span className={cn("inline-flex items-center rounded-[10px] bg-cream px-2.5 py-1.5", className)}>{img}</span>
  );
}

/** The maker's own circular FF mark (public/brand/logo-mark-circle.png), used as the sticker/favicon/small badge. */
export function FFMonogram({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- small inline mark used at many fixed sizes; next/image adds no benefit here.
    <img src="/brand/logo-mark-circle.png" alt="FuzzBall Factory" className={cn("size-9 rounded-full object-contain", className)} />
  );
}
