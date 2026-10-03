"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Decorative CSS loops ([data-loop]) stop while they are off screen, so the compositor can rest. */
export function PauseOffscreenLoops() {
  const pathname = usePathname();
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-loop]"));
    if (els.length === 0) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) e.target.removeAttribute("data-paused");
        else e.target.setAttribute("data-paused", "");
      }
    });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
