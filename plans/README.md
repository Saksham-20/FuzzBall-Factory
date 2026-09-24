# Animation plans

Written by the `improve-animations` audit of the storefront home on 2026-09-23 (branch `design/landing-polish`; line references match commit `364770d`, and each plan anchors its steps on quoted code, so a moved line is not a blocker). Each plan is self-contained: exact files, current code, target values, steps, boundaries and a feel check, so any agent can execute it without this conversation.

These cover the motion that already existed before the landing polish. The motion added in that polish (hand-wound yarn ball, batch ticket swing, stitch glyphs, lead-time bars, work-order stamps, the pegged photo line and its swing) was built to the same rules and is not re-planned here.

## Plans

| # | Plan | Severity | Status |
| --- | --- | --- | --- |
| 001 | [Stop `.press` from swallowing every hover transition](001-press-keeps-hover-transitions.md) | MEDIUM | TODO |
| 002 | [Scroll reveals: fire earlier, finish faster, leave headings alone](002-reveals-earlier-and-fewer.md) | MEDIUM | TODO |
| 003 | [Station node stamps when the thread reaches it](003-station-node-stamps-when-thread-arrives.md) | LOW | TODO |
| 004 | [Pause decorative loops while off screen](004-pause-loops-offscreen.md) | LOW | TODO |
| 005 | [Header: stop animating `backdrop-filter`](005-header-no-backdrop-filter-transition.md) | LOW | TODO |

## Recommended order

1. **001** first: one line, site-wide, and it makes every later hover check meaningful.
2. **002**, then **003**: both touch how sections arrive; do 002 first so the node stamp in 003 is judged against the calmer reveals. 003 also removes a dead `data-reveal="stamp"` attribute that 002 does not touch.
3. **004** and **005** are independent and can go in any order.

No plan depends on another's code. 001, 002, 003 and 004 all edit `web/src/app/globals.css`, each in a different block, so they can land in any order without conflicts.

## Audit findings

| # | Severity | Category | Location | Finding | Fix summary |
| --- | --- | --- | --- | --- | --- |
| 1 | MEDIUM | Easing & duration | `web/src/app/globals.css:161` | `.press` shorthand resets `transition-property` to `transform`, discarding the colour/shadow transitions of 17 components (hover snaps) | Plan 001 |
| 2 | MEDIUM | Purpose & cohesion | `web/src/components/ui/Reveal.tsx:38`, `web/src/app/globals.css:195-213`, 8 headings | Same fade-and-rise on nearly every block, fired late (8% visible inside a 10%-shrunk viewport), 600-700ms | Plan 002 |
| 3 | LOW | Missed opportunity | `web/src/components/brand/StationNode.tsx:18`, `ConveyorThread.tsx:205` | Thread reaching a station only recolours the node; `data-reveal="stamp"` is dead | Plan 003 |
| 4 | LOW | Performance | `web/src/components/home/ConveyorThread.tsx:209-212` | `data-live` rewritten on every node every scroll frame | Plan 003 |
| 5 | LOW | Performance | `web/src/app/globals.css:303`, `:318` | Ball sway and marquee loop forever off screen | Plan 004 |
| 6 | LOW | Performance | `web/src/components/store/Header.tsx:35` | `backdrop-filter` is interpolated on the scroll-state change | Plan 005 |
| 7 | LOW | Cohesion | `web/src/components/store/ProductTicket.tsx` (second image) | Hover crossfade shows both photos at once midway | Not planned: a `filter: blur(2px)` mask during the fade would hide it; judge by eye first |
| 8 | LOW | Easing & duration | `web/src/components/store/WhatsAppButton.tsx` (nudge) | Nudge tooltip exits at the same 300ms as it enters | Not planned: exit at ~200ms if it ever feels slow to leave |

Already right and left alone: button press scale 0.97 at 160ms ease-out; origin-aware dropdown (180ms); drawer in 380ms / out 240ms on the iOS curve; hover effects gated to fine pointers; linear marquee; reduced-motion handling for reveals, the hero and the thread.
