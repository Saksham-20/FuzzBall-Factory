# 002 — Scroll reveals: fire earlier, finish faster, and leave headings alone

- **Status**: TODO
- **Commit**: 364770d
- **Severity**: MEDIUM
- **Category**: Purpose & frequency / Cohesion
- **Estimated scope**: 7 files, small edits

## Problem

The same fade-and-rise runs on almost every block of the home page, section headings included, so it reads as a template effect rather than the page's own motion (the page's authored moments are the scroll-drawn thread, the hero entrance, the ticket drops, the stitch glyphs, the lead-time bars and the work-order stamps). It also fires late: an element must be 8% visible **inside a viewport shrunk 10% from the bottom** before it starts a 600–700ms fade, so with smooth scrolling a quick reader sees empty space where copy should be.

```ts
// web/src/components/ui/Reveal.tsx:38 — current
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
```

```css
/* web/src/app/globals.css:195 — current */
[data-reveal][data-armed]:not([data-in]) {
  opacity: 0;
  transform: translateY(16px);
}
/* web/src/app/globals.css:208 — current */
[data-reveal][data-armed] {
  transition:
    opacity 600ms var(--ease-out),
    transform 700ms var(--ease-out);
  transition-delay: var(--d, 0ms);
}
/* web/src/app/globals.css:247 — current (the pegged photo line: its photos carry their own timing) */
[data-reveal="line"][data-armed] .hang {
  transition:
    opacity 600ms var(--ease-out),
    transform 700ms var(--ease-out);
  transition-delay: calc(var(--d, 0ms) + var(--i, 0) * 40ms);
}
```

Headings and lone paragraphs wrapped in `Reveal` (all generic `rise`):

- `web/src/components/home/YarnRoom.tsx:42` — `<Reveal as="h2" ...>Every piece starts as a ball of yarn</Reveal>`
- `web/src/components/home/YarnRoom.tsx:45` — `<Reveal as="p" delay={60} ...>The fiber decides how a piece feels...</Reveal>`
- `web/src/components/home/YarnRoom.tsx:61` — `<Reveal as="p" delay={100} ...>Colours can look a little different...</Reveal>`
- `web/src/components/home/HookFloor.tsx:76` — `<Reveal as="h2" ...>Made by one pair of hands</Reveal>`
- `web/src/components/home/Shelf.tsx:30` — `<Reveal as="h2" ...>The shelf</Reveal>`
- `web/src/components/home/Shelf.tsx:73` — `<Reveal as="h3" ...>Fresh off the line</Reveal>`
- `web/src/components/home/ShippingDock.tsx:24` — `<Reveal as="h2" ...>Packed with care, shipped anywhere</Reveal>`
- `web/src/components/home/WorkOrders.tsx:29` — `<Reveal as="h2" ...>Got an idea? Put in a work order.</Reveal>`

## Target

1. Reveals start as soon as an element is about to enter, and finish quicker with a shorter travel:

```ts
// web/src/components/ui/Reveal.tsx — target
      { rootMargin: "0px 0px -4% 0px", threshold: 0.01 },
```

```css
/* web/src/app/globals.css — target */
[data-reveal][data-armed]:not([data-in]) {
  opacity: 0;
  transform: translateY(12px);
}
[data-reveal][data-armed] {
  transition:
    opacity 450ms var(--ease-out),
    transform 550ms var(--ease-out);
  transition-delay: var(--d, 0ms);
}
[data-reveal="line"][data-armed] .hang {
  transition:
    opacity 450ms var(--ease-out),
    transform 550ms var(--ease-out);
  transition-delay: calc(var(--d, 0ms) + var(--i, 0) * 40ms);
}
```

2. The eight headings/paragraphs listed above are plain elements (no reveal). Lists keep their staggered reveals, tickets keep `kind="drop"`, and the explainers (stitch glyphs, lead-time bars, stamps) keep working because their `Reveal` parents are untouched.

## Repo conventions to follow

- `Reveal` keeps content visible without JS; do not change that logic (the `already on screen` early return at `Reveal.tsx:29` stays).
- The `stamp`, `drop` and `slide` variants (the three rules right after the first quoted rule) are not touched, and neither is the `line` variant's hidden state (`translateY(-12px)` already matches the new travel).
- Exemplar of a plain section heading: `web/src/components/home/MakerNote.tsx` (`<h2 className="font-display ...">`).

## Steps

Line numbers are hints; each step's quoted code is the anchor.

1. `web/src/components/ui/Reveal.tsx` (currently line 38): change the observer options object `{ rootMargin: "0px 0px -10% 0px", threshold: 0.08 }` to `{ rootMargin: "0px 0px -4% 0px", threshold: 0.01 }`.
2. `web/src/app/globals.css`, in the `[data-reveal][data-armed]:not([data-in]) { ... }` rule quoted in **Problem** (currently line 195): `translateY(16px)` → `translateY(12px)`.
3. Same file, in the `[data-reveal][data-armed] { ... }` rule quoted in **Problem** (currently line 208): `opacity 600ms` → `opacity 450ms`, `transform 700ms` → `transform 550ms`.
4. Same file, in the `[data-reveal="line"][data-armed] .hang { ... }` rule quoted in **Problem** (currently line 247): the same two changes, so the pegged photos keep pace with every other reveal. Leave its `transition-delay` line alone.
5. For each of the eight elements listed in **Problem**: replace `<Reveal as="h2" className="X">…</Reveal>` with `<h2 className="X">…</h2>` (same for `as="h3"` → `<h3>` and `as="p"` → `<p>`), keeping `className` and children exactly; drop the `delay` prop. Keep every other `Reveal` in those files.
6. Each of those files still uses `Reveal` elsewhere, so keep the `Reveal` import. Run lint to confirm no unused import remains.

## Boundaries

- Do NOT remove reveals from lists (`<Reveal as="li">`, fiber rows, shipping facts, shelf doors, product tickets, the pegged photo line) or from tickets (`kind="drop"`).
- Do NOT change `ConveyorThread`, `Hero` or any explainer CSS (`.stitch-draw`, `.grow-bar`, `.stamp-seq`).
- Do NOT add dependencies. If any quoted code has drifted (not just its line number), STOP and report.

## Verification

- **Mechanical**: `cd web && npx tsc --noEmit -p . && npm run lint` exit 0.
- **Feel check** on `/` (desktop and a 390px phone):
  - Scroll fast with the mouse wheel from the hero to the footer: no section heading is ever blank on arrival; body copy is fully in within about half a second of entering.
  - Headings arrive already in place; the station node going rose and the thread reaching it mark the arrival.
  - Fiber rows, shipping facts and shelf door words still stagger in; the Yarn Room and Hook Floor photo tickets still drop in; the Hook Floor glyphs still stitch in; the work-order stamps still land one by one; the pegged photos still drop onto their line one after another.
  - DevTools > Rendering > `prefers-reduced-motion: reduce`, reload: everything is visible immediately and nothing moves.
- **Done when**: all feel checks hold and `grep -n 'Reveal as="h2"\|Reveal as="h3"\|Reveal as="p"' web/src/components/home/*.tsx` prints nothing.
