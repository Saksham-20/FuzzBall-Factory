"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { Modal } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";

interface Props {
  images: { src: string; alt: string }[];
  name: string;
  soldOut?: boolean;
  className?: string;
}


/**
 * Product photos: a scroll-snap strip (swipe on phones, trackpad and thumbnails
 * on desktop), plus a click-to-zoom lightbox.
 */
export function Gallery({ images, name, soldOut, className }: Props) {
  const strip = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const raf = useRef(0);
  const n = images.length;

  const onScroll = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = strip.current;
      if (el && el.clientWidth) setIndex(Math.round(el.scrollLeft / el.clientWidth));
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const goTo = (i: number) => {
    const el = strip.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: i * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
    setIndex(i);
  };

  const openLightbox = (i: number) => {
    setZoomed(false);
    setLightbox(i);
  };
  const step = (dir: 1 | -1) => {
    setZoomed(false);
    setLightbox((cur) => (cur === null ? cur : (cur + dir + n) % n));
  };

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-ticket bg-paper shadow-ticket">
        <ul
          ref={strip}
          onScroll={onScroll}
          aria-label={`${name} photos`}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {images.map((img, i) => (
            <li key={img.src + i} className="relative aspect-[4/5] w-full shrink-0 snap-center">
              <button
                type="button"
                onClick={() => openLightbox(i)}
                aria-label={`Zoom photo ${i + 1} of ${n}: ${img.alt}`}
                className="absolute inset-0 cursor-zoom-in outline-offset-[-4px]"
              >
                <Image
                  src={img.src}
                  alt={img.alt}
                  fill
                  priority={i === 0}
                  sizes="(min-width:1024px) 58vw, 100vw"
                  className={cn("object-cover", soldOut && "saturate-[0.35]")}
                />
              </button>
            </li>
          ))}
        </ul>
        {n > 1 ? (
          <span
            aria-hidden
            className="font-stencil tabular pointer-events-none absolute right-3 bottom-3 rounded-full bg-cocoa/85 px-2.5 py-1 text-[11px] text-cream"
          >
            {index + 1} / {n}
          </span>
        ) : null}
        <span
          aria-hidden
          className="pointer-events-none absolute top-3 right-3 hidden size-9 place-items-center rounded-full bg-paper/90 text-cocoa sm:grid"
        >
          <ZoomIn className="size-[18px]" strokeWidth={1.8} />
        </span>
      </div>

      {n > 1 ? (
        <ul className="mt-3 flex gap-2" aria-label="Choose a photo">
          {images.map((img, i) => (
            <li key={img.src + i}>
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Show photo ${i + 1} of ${n}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "press relative block size-16 overflow-hidden rounded-[10px] bg-paper ring-offset-2 ring-offset-cream transition-shadow duration-150 sm:size-[72px]",
                  i === index ? "ring-2 ring-cocoa" : `ring-1 ring-line-strong hf:hover:ring-cocoa/60`,
                )}
              >
                <Image src={img.src} alt="" fill sizes="72px" className={cn("object-cover", soldOut && "saturate-[0.35]")} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Modal
        open={lightbox !== null}
        onOpenChange={(o) => !o && setLightbox(null)}
        title={name}
        className="w-[min(94vw,760px)]"
      >
        {lightbox !== null ? (
          <div>
            <div
              data-lenis-prevent
              className="max-h-[66dvh] touch-pan-x touch-pan-y touch-pinch-zoom overflow-auto rounded-[10px] bg-cream"
            >
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                aria-label={zoomed ? "Zoom out" : "Zoom in"}
                className={cn("relative block aspect-[4/5]", zoomed ? "w-[190%] cursor-zoom-out" : "w-full cursor-zoom-in")}
              >
                <Image
                  src={images[lightbox].src}
                  alt={images[lightbox].alt}
                  fill
                  sizes={zoomed ? "1500px" : "(min-width:768px) 712px, 90vw"}
                  className="object-cover"
                />
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="min-w-0 text-sm text-brown">{images[lightbox].alt}</p>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoomed((z) => !z)}
                  aria-label={zoomed ? "Zoom out" : "Zoom in"}
                  className={cn("press grid size-11 place-items-center rounded-full", `hf:hover:bg-cocoa/8`)}
                >
                  {zoomed ? <ZoomOut className="size-5" strokeWidth={1.8} /> : <ZoomIn className="size-5" strokeWidth={1.8} />}
                </button>
                {n > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={() => step(-1)}
                      aria-label="Previous photo"
                      className={cn("press grid size-11 place-items-center rounded-full", `hf:hover:bg-cocoa/8`)}
                    >
                      <ChevronLeft className="size-5" strokeWidth={1.8} />
                    </button>
                    <span aria-live="polite" className="tabular min-w-10 text-center text-sm font-semibold">
                      {lightbox + 1} / {n}
                    </span>
                    <button
                      type="button"
                      onClick={() => step(1)}
                      aria-label="Next photo"
                      className={cn("press grid size-11 place-items-center rounded-full", `hf:hover:bg-cocoa/8`)}
                    >
                      <ChevronRight className="size-5" strokeWidth={1.8} />
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
