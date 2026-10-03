---
target: storefront landing page (home primary, storefront skim)
total_score: 22
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:/Users/sakshampanjla/Desktop/REACT/FuzzBall Factory/web/src/app/(store)/page.tsx"
target_fingerprint: "sha256:1d81944911ed4c93b30d63bf4b08869f379fbf7014292eb5002083acde911f03"
target_path: /Users/sakshampanjla/Desktop/REACT/FuzzBall Factory/web/src/app/(store)/page.tsx
timestamp: 2026-10-03T15-55-21Z
slug: web-src-app-store-page-tsx
---
Method: dual-agent (A: isolated design-review sub-agent · B: isolated detector/browser sub-agent). Browser: headless Playwright (Chrome extension not connected), production build, mock data, 8 widths 320–1920 plus /shop, /p/whale-red, /custom, /about, /track, /drops.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Live node and pause states clear; taps dead ~1.7s after paint on 4x-throttled phone |
| 2 | Match System / Real World | 3 | Warm plain copy; "worldwide" promised at India-only launch; jargon (work order, ISB, Batch #) |
| 3 | User Control and Freedom | 3 | All loops pausable, reduced motion honoured; Lenis wheel smoothing only off via OS setting |
| 4 | Consistency and Standards | 2 | Whale card: no price/not tappable on home vs price/link on /shop; Batch #002 = pod (home) vs yellow whale (shop); 5 column splits; tracking phone vs phone-or-email |
| 5 | Error Prevention | 3 | Deposit reassurance good; "Customize a whale" -> /shop; hero CTA ignores `listed` |
| 6 | Recognition Rather Than Recall | 3 | Price absent from landing; station names hidden on phones |
| 7 | Flexibility and Efficiency | n/a | Persuade surface |
| 8 | Aesthetic and Minimalist Design | 2 | ~14 phone screens; pod photo x2, hedgehog x4, WhatsApp x3 in last viewport; placeholder fibre table; dead band before maker note (A scored 3) |
| 9 | Error Recovery | 3 | Graceful catalogue fallback; landing tracking errors surface only on /track |
| 10 | Help and Documentation | n/a | Persuade surface |
| **Total** | | **22/32 (69%)** | **Acceptable, top edge** |

## Design Specificity Verdict

LLM: look and signature are fully ownable (thread, tickets with punched holes, shape-coded stamps, maker's own clips). Structure is generic: standard handmade-shop section order; middle third repeats one layout 5x (tilted ticket photo + Modak heading + hairline list); thesis "production line = order status" shown only as one example ticket; the whales (only buyable thing) sit outside the numbered stations.

Deterministic: source scan 0 findings (42 tsx, 5 ts). URL scan 21 warnings: 12 low-contrast are a detector bug (kraft radial gradients ending rgba(0,0,0,0) resolved as black; real 5.9-9.6:1; axe 0 contrast violations); cream-palette + marquee are named DESIGN.md rules; layout-transition is Sonner's stylesheet; text-occlusion = tape pause button / stretched-link overlay; cramped-padding false positive. True positives: /about "Shop the shelf" 1.0:1; stencil sentences (/about figcaption; hero stencil line borderline). Nested ticket inside maker paper card is intentional layering.

Overlays: none user-visible; site CSP blocks the injected detector (B used bypassCSP in its test browser only).

## Overall Impression

Concept is top-tier. Problems are sequencing, commerce clarity and one perf bug: the product (whale, Rs 399, ready to ship) is a 140px thumbnail in the hero and price never appears on the page; the maker/sold-out-stall proof sits ~80% down; on mid-range phones the thread build freezes the page ~1.7s. Biggest opportunity: product-led, 8 blocks -> 5, thread stays the spine.

## What's Working

1. Thread as spine: continuity, scroll indicator, reduced-motion safe, 0 overflow at 8 widths, nodes within 4px of headings >=1024.
2. Honesty built into the system: Example badges, day ruler, natural-light photo path, real SOLD OUT stall, maker's own photos/clips.
3. Hero: one idea, clear next step; disciplined type trio; CLS 0; LCP 1.62s at 4x CPU + Fast 3G.

## Priority Issues

[P1] Thread build freezes phones on arrival. 8,736 getPointAtLength calls = 2.57s at 4x CPU; long tasks 1,757ms + 865ms; same under reduced motion; intro draws in 3 frames. Cause: web/src/components/home/ConveyorThread.tsx:64, :188-193 (4px lookup), :172-186 (2 calls per stitch), double build :244 + :271. Fix: compute points from the Bezier segments smoothPath already builds; skip lookup under reduced motion; skip rebuild when layout unchanged. Target: build <50ms, no long task >200ms. Command: optimize.

[P1] "Worldwide/anywhere" promised 6x vs India-only launch: Hero.tsx:13, :52; ShippingDock.tsx:11, :22; shop/DeliveryCheck.tsx:102; shop/ProductDetails.tsx:74. Fix: one flag (later admin intlZones): "Ships across India", "Packed with care, shipped across India", drop Worldwide row. Command: clarify.

[P1] Two checkout-path blockers (outside landing): /about "Shop the shelf" invisible (content/Prose.tsx:14 `[&_a]:text-cocoa` beats Button text-cream; about/page.tsx:131). Phone add-to-cart toast covers drawer Checkout (390: toast y709-760 vs button 720-772; 360: 645-696 vs 656-708); fix: no toast when drawer opens. Command: harden.

[P2] Whale cards look tappable, aren't, hide price: tap hits VIDEO; hover lift on non-links (WhalePod.tsx:63, TheCrew.tsx:51); separate "see the listing" text links wrap at 390; 10 controls in one section; /shop shows Rs 399 + Ready to ship for same products. Fix: whole card = stretched link, play button z-10 above; price + status row; one clip plays at a time. Command: distill + clarify.

[P2] Sequencing / length / rhythm: ~11,870px at 390 (~14 screens); last shop CTA ~20% deep; maker proof ~80% deep; 1,600px placeholder fibre table before shipping/price; section gaps 88-328px at 1440 (61-241 at 390); 5 column ratios (text edges drift 36px). Fix: 5-block restructure, one section-spacing token, two shared splits. Command: layout + distill.

## Persona Red Flags

Jordan (first-timer): "work order" unexplained ~8 screens; bare 01-04 nodes on phones; whale photo tap dead; Batch #002 two meanings; Drops = Shop.
Riley (stress tester): worldwide x6; hero CTA unguarded; "Customize a whale" -> /shop though /custom?from= exists; /shop sidebar 7 empty shelves; /about invisible CTA.
Casey (mobile): taps dead ~1.7s; 320 no CTA in first view; toast covers Checkout; FAB covers copy.
Ananya (19, Redmi, gifter from reel): no price on landing; "leaves 1-2 days" not "arrives"; gift wrap Rs 59 + COD clear but buried.
Rohan (custom, Rs 1,500): hero frames custom as "a whale in another colour"; step 1 omits needed-by date; no list of idea types.

## Minor Observations

Node marks photo not heading on phones (node 01 y2547 vs heading 3077); WO step discs read as station nodes; axe: WhatsApp FAB outside landmark; 11px stencil heads (floor 12, info 13); hero stencil line -> Figtree 15px, stop duplicating tape; tracking form phone vs phone-or-email, prefill +91; whale-pod.jpg loaded twice; posters raw not via next/image; em dashes in WO copy; ISB unexpanded; Customize vs colour spelling; stale STATIONS constant + Shelf.tsx; tape pause patch cuts words ("SOLD OU|ISB"); Lenis rAF loop runs while idle.

Motion (vetted): plans 001-005 still open (001 confirmed live: hero buttons transition `transform` only; 005 confirmed: header transitions backdrop-filter; 003: dead data-reveal="stamp"). New: thread build cost (HIGH), Lenis latency (MED), simultaneous clips (MED), idle ball sway (LOW), hover lift on non-links (LOW), slow hero entrance (LOW). Missed opportunities: ball unwinds with thread; ticket hangs on thread through its hole; thread ends at final CTA; add-to-bag stamp.

Proposed structure: Hero (product-led) -> 01 The Shelf (4 real product cards) -> 02 Hook Floor (maker + steps + leaves/arrives ruler) -> 03 Work Orders (crew -> /custom?idea=, steps incl. needed-by date) -> 04 Shipping Dock (4 facts, track link, thread ends at final buy row) -> footer. ~40% shorter on phones.

## Questions to Consider

1. What if the whales were Station 01 "The Shelf", so the thread runs past what you can buy?
2. What if the ticket hung on the thread, making "Yarn in. Fuzzballs out." one object?
3. Does a 14-screen phone page need a fibre table before anyone picks a whale?
4. Should the thread's loose end land on the final buy button?
