"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { animate } from "motion";
import { YarnBall } from "@/components/brand/YarnBall";

export interface Flight {
  id: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

const SIZE = 44;

/** Where the header bag icon is right now, or null if it isn't on screen. */
export function bagCenter(): { x: number; y: number } | null {
  const el = document.querySelector<HTMLElement>('button[aria-label^="Open basket"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0) return null;
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The one motion moment on the product page: a yarn ball hops from the button
 * to the bag along a curve (x eases in, y eases out, so the path bends), 550ms.
 * The caller skips this entirely for reduced motion and keyboard activation.
 */
export function FlyingBall({ flight, onDone }: { flight: Flight; onDone: () => void }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!o || !i) return;
    const dx = flight.to.x - flight.from.x;
    const dy = flight.to.y - flight.from.y;
    const duration = 0.55;
    const runs = [
      animate(o, { x: [0, dx] }, { duration, ease: [0.5, 0, 0.9, 0.5] }),
      animate(i, { y: [0, dy] }, { duration, ease: [0.1, 0.6, 0.35, 1] }),
      animate(
        i,
        { scale: [0.9, 1, 0.4], opacity: [0, 1, 1, 0], rotate: [0, 200] },
        { duration, ease: "easeOut", times: [0, 0.12, 0.85, 1] },
      ),
    ];
    let live = true;
    Promise.all(runs.map((r) => r.finished)).then(
      () => live && onDone(),
      () => live && onDone(),
    );
    return () => {
      live = false;
      runs.forEach((r) => r.cancel());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.id]);

  return createPortal(
    <div
      ref={outer}
      aria-hidden
      className="pointer-events-none fixed z-[80]"
      style={{ left: flight.from.x - SIZE / 2, top: flight.from.y - SIZE / 2 }}
    >
      <div ref={inner} style={{ width: SIZE, height: SIZE, opacity: 0 }}>
        <YarnBall className="size-full" spin={false} small />
      </div>
    </div>,
    document.body,
  );
}
