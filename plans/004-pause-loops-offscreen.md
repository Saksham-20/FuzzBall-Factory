# 004 — Pause decorative loops while they are off screen

- **Status**: TODO
- **Commit**: 364770d
- **Severity**: LOW
- **Category**: Performance / Accessibility
- **Estimated scope**: 4 files, 1 new small client component

## Problem

Two decorative CSS loops run forever, including after the reader has scrolled far past them, keeping the compositor awake (battery on the mid-range Android phones most shoppers use):

```css
/* web/src/app/globals.css:305 — current */
.tape-track {
  animation: tape 42s linear infinite;
}
/* web/src/app/globals.css:323 — current */
.ball-wraps {
  transform-origin: 50% 50%;
  animation: sway 9s var(--ease-in-out) infinite;
}
```

Used by the hero yarn ball and marquee (`web/src/components/home/Hero.tsx:55`, `:67`) and the auth layout (`web/src/app/(auth)/layout.tsx:42`, `:53`). The loop elements are rendered here:

```tsx
// web/src/components/brand/YarnBall.tsx — the wraps layer
        <svg
          viewBox="10 10 380 380"
          className={cn("absolute inset-0 size-full", spin && "ball-wraps")}
          fill="none"
          strokeLinecap="round"
        >
// web/src/components/brand/Tape.tsx:49
        <div className="tape-track flex w-max">
```

## Target

- Loop elements carry `data-loop`. One client component, mounted once in the root layout, observes every `[data-loop]` element and sets `data-paused` while it is fully off screen; it re-scans on route change.
- CSS pauses paused loops: `[data-loop][data-paused] { animation-play-state: paused; }`
- The existing tape rule keeps working: `.tape-track:hover, .tape:has([data-tape-toggle][aria-pressed="true"]) .tape-track { animation-play-state: paused; }` (pointing at the words holds them still; the tape's pause button stops it until pressed again).

```tsx
// web/src/components/store/PauseOffscreenLoops.tsx — new
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
```

```css
/* web/src/app/globals.css — add right after the .ball-wraps rule */
[data-loop][data-paused] {
  animation-play-state: paused;
}
```

## Repo conventions to follow

- Small client-only behaviour components live in `web/src/components/store/` and render `null` (exemplar: `web/src/components/store/SmoothScroll.tsx`).
- Next 16: `usePathname` comes from `next/navigation` (read `web/node_modules/next/dist/docs/01-app/` if unsure).

## Steps

1. Create `web/src/components/store/PauseOffscreenLoops.tsx` with the code in **Target**.
2. `web/src/app/layout.tsx`: import it (`import { PauseOffscreenLoops } from "@/components/store/PauseOffscreenLoops";`) and render `<PauseOffscreenLoops />` directly after `<Providers>{children}</Providers>` inside `<body>`.
3. `web/src/components/brand/YarnBall.tsx`: on the wraps `<svg>` add `data-loop={spin ? "" : undefined}`.
4. `web/src/components/brand/Tape.tsx:49`: add `data-loop` to `<div className="tape-track flex w-max">`.
5. `web/src/app/globals.css`: add the `[data-loop][data-paused]` rule right after the `.ball-wraps { ... }` rule.

## Boundaries

- Do NOT change durations, keyframes or easing of `sway`, `tape`, or `march`.
- Do NOT pause `.thread-march` (it marks live status on order timelines and runs only while visible anyway).
- Do NOT touch the tape's pause button (`web/src/components/brand/TapeToggle.tsx`) or its rule. It keeps its state in `aria-pressed`, not `data-paused`, so the observer can never restart a tape a reader stopped.
- Do NOT add dependencies. If the quoted code has drifted (not just its line number), STOP and report.

## Verification

- **Mechanical**: `cd web && npx tsc --noEmit -p . && npm run lint && NEXT_DIST_DIR=.next-verify npx next build && npm run test:e2e` exit 0. Build into its own dist dir: a plain `npm run build` overwrites the `.next` that a running `next start` serves. The browser tests include the tape's pause button.
- **Behaviour**: on `/`, scroll to the footer, then in the console run `document.querySelectorAll('[data-loop][data-paused]').length` → `2`. Scroll back to the top → `0`.
- **Feel check**: back at the hero the ball and the tape continue from where they paused (no jump to a new position); hovering the tape still holds it; its pause button still stops it, and a stopped tape stays stopped after scrolling to the footer and back; `/login` ball and tape still move; reduced motion still shows both static.
- **Done when**: all checks hold.
