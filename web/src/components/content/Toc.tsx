"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface TocItem {
  id: string;
  title: string;
}

/**
 * "On this page". Desktop: sticky list that marks the section being read.
 * Mobile: a collapsed disclosure above the text. Built from the same section list as the headings.
 */
export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null);
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        const first = items.find((i) => visible.has(i.id));
        if (first) setActive(first.id);
      },
      { rootMargin: "-100px 0px -65% 0px" },
    );
    for (const i of items) {
      const el = document.getElementById(i.id);
      if (el) io.observe(el);
    }
    return () => io.disconnect();
  }, [items]);

  const list = (
    <ul className="space-y-0.5">
      {items.map((i) => {
        const on = active === i.id;
        return (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              aria-current={on ? "location" : undefined}
              onClick={() => {
                if (details.current) details.current.open = false;
              }}
              className={cn(
                "flex min-h-11 items-center rounded-[10px] px-3 py-1.5 text-[15px] leading-snug transition-colors duration-150 lg:min-h-9",
                on ? "bg-kraft-light font-bold text-cocoa" : "text-brown [@media(hover:hover)_and_(pointer:fine)]:hover:text-cocoa",
              )}
            >
              {i.title}
            </a>
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav aria-label="On this page">
      <details ref={details} className="group rounded-[12px] bg-paper shadow-ticket lg:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 font-semibold [&::-webkit-details-marker]:hidden">
          On this page
          <ChevronDown aria-hidden strokeWidth={1.8} className="size-5 transition-transform duration-200 ease-out group-open:rotate-180" />
        </summary>
        <div className="px-1.5 pb-2">{list}</div>
      </details>
      <div className="hidden lg:block">
        <p className="font-stencil mb-2 px-3 text-[12px] text-brown-soft">On this page</p>
        {list}
      </div>
    </nav>
  );
}
