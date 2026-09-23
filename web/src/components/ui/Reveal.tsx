"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef, type ElementType } from "react";

type Kind = "rise" | "stamp" | "drop" | "slide";

interface Props extends ComponentPropsWithoutRef<"div"> {
  kind?: Kind;
  /** ms delay, for staggering siblings (keep it 30–80ms apart). */
  delay?: number;
  as?: ElementType;
}

/**
 * Scroll reveal. Content is fully visible in the server HTML; after mount the
 * element is "armed" (hidden) only if it is below the fold, then revealed by an
 * IntersectionObserver. No JS, or reduced motion, means it is simply visible.
 */
export function Reveal({ kind = "rise", delay = 0, as, children, style, ...rest }: Props) {
  const Tag = (as ?? "div") as ElementType;
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.92 && r.bottom > 0) return; // already on screen
    el.setAttribute("data-armed", "");
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.setAttribute("data-in", "");
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} data-reveal={kind} style={{ ...style, ["--d" as string]: `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}
