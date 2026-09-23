# 002 — Scroll reveals: fire earlier, finish faster, and leave headings alone

- **Status**: TODO
- **Commit**: 7cc98fe
- **Severity**: MEDIUM
- **Category**: Purpose & frequency / Cohesion
- **Estimated scope**: 7 files, small edits

## Problem

The same fade-and-rise runs on almost every block of the home page, section headings included, so it reads as a template effect rather than the page's own motion (the page's authored moments are the scroll-drawn thread, the hero entrance, the ticket drops, the stitch glyphs, the lead-time bars and the work-order stamps). It also fires late: an element must be 8% visible **inside a viewport shrunk 10% from the bottom** before it starts a 600–700ms fade, so with smooth scrolling a quick reader sees empty space where copy should be.

```ts
// web/src/components/ui/Reveal.tsx:37 — current
      { rootMargin: "0px 0px -10% 0px", threshold: 0.08 },
```

```css
/* web/src/app/globals.css:192 — current */
[data-reveal][data-armed]:not([data-in]) {
  opacity: 0;
  transform: translateY(16px);
}
/* web/src/app/globals.css:205 — current */
[data-reveal][data-armed] {
  transition:
    opacity 600ms var(--ease-out),
    transform 700ms var(--ease-out);
  transition-delay: var(--d, 0ms);
}
```

Headings and lone paragraphs wrapped in `Reveal` (all generic `rise`):

- `web/src/components/home/YarnRoom.tsx:41` — `<Reveal as="h2" ...>Every piece starts as a ball of yarn</Reveal>`
- `web/src/components/home/YarnRoom.tsx:44` — `<Reveal as="p" delay={60} ...>The fiber decides how a piece feels...</Reveal>`
- `web/src/components/home/YarnRoom.tsx:60` — `<Reveal as="p" delay={100} ...>Colours can look a little different...</Reveal>`
- `web/src/components/home/HookFloor.tsx:76` — `<Reveal as="h2" ...>Made by one pair of hands</Reveal>`
- `web/src/components/home/Shelf.tsx:22` — `<Reveal as="h2" ...>The shelf</Reveal>`
- `web/src/components/home/Shelf.tsx:68` — `<Reveal as="h3" ...>Fresh off the line</Reveal>`
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
```

2. The eight headings/paragraphs listed above are plain elements (no reveal). Lists keep their staggered reveals, tickets keep `kind="drop"`, and the explainers (stitch glyphs, lead-time bars, stamps) keep working because their `Reveal` parents are untouched.

## Repo conventions to follow

- `Reveal` keeps content visible without JS; do not change that logic (the `already on screen` early return at `Reveal.tsx:28` stays).
- The `drop`, `stamp` and `slide` variants at `globals.css:196-204` are not touched.
- Exemplar of a plain section heading: `web/src/components/home/MakerNote.tsx` (`<h2 className="font-display ...">`).

## Steps

1. `web/src/components/ui/Reveal.tsx:37`: change the observer options object to `{ rootMargin: "0px 0px -4% 0px", threshold: 0.01 }`.
2. `web/src/app/globals.css:194`: `translateY(16px)` → `translateY(12px)`.
3. `web/src/app/globals.css:207-208`: `opacity 600ms` → `opacity 450ms`, `transform 700ms` → `transform 550ms`.
4. For each of the eight elements listed in **Problem**: replace `<Reveal as="h2" className="X">…</Reveal>` with `<h2 className="X">…</h2>` (same for `as="h3"` → `<h3>` and `as="p"` → `<p>`), keeping `className` and children exactly; drop the `delay` prop. Keep every other `Reveal` in those files.
5. Each of those files still uses `Reveal` elsewhere, so keep the `Reveal` import. Run lint to confirm no unused import remains.

## Boundaries

- Do NOT remove reveals from lists (`<Reveal as="li">`, fiber rows, shipping facts, shelf doors, product tickets) or from tickets (`kind="drop"`).
- Do NOT change `ConveyorThread`, `Hero` or any explainer CSS (`.stitch-draw`, `.grow-bar`, `.stamp-seq`).
- Do NOT add dependencies. If any listed line has drifted, STOP and report.

## Verification

- **Mechanical**: `cd web && npx tsc --noEmit -p . && npm run lint` exit 0.
- **Feel check** on `/` (desktop and a 390px phone):
  - Scroll fast with the mouse wheel from the hero to the footer: no section heading is ever blank on arrival; body copy is fully in within about half a second of entering.
  - Headings arrive already in place; the station node going rose and the thread reaching it mark the arrival.
  - Fiber rows, shipping facts and shelf door words still stagger in; the Yarn Room and Hook Floor photo tickets still drop in; the Hook Floor glyphs still stitch in; the work-order stamps still land one by one.
  - DevTools > Rendering > `prefers-reduced-motion: reduce`, reload: everything is visible immediately and nothing moves.
- **Done when**: all feel checks hold and `grep -n 'Reveal as="h2"\|Reveal as="h3"\|Reveal as="p"' web/src/components/home/*.tsx` prints nothing.
