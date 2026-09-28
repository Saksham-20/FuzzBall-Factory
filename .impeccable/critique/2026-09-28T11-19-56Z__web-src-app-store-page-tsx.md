---
target: whole storefront UI/UX review (home primary, shop/checkout/account skim)
total_score: 27
max_score: 32
na_heuristics: 7,10
p0_count: 0
p1_count: 3
target_identity: "file:/Users/sakshampanjla/Desktop/REACT/FuzzBall Factory/web/src/app/(store)/page.tsx"
target_fingerprint: "sha256:5043845d610f12a002c286c876fd031830b6a75befbb8085af53c22e100a011b"
target_path: /Users/sakshampanjla/Desktop/REACT/FuzzBall Factory/web/src/app/(store)/page.tsx
timestamp: 2026-09-28T11-19-56Z
slug: web-src-app-store-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Live thread node, aria-live loading states, stamp sequence all clear |
| 2 | Match System / Real World | 4 | Factory/yarn vocabulary used consistently and correctly |
| 3 | User Control and Freedom | 3 | Filter chips removable + "Clear all"; no visible undo/back on custom work-order flow |
| 4 | Consistency and Standards | 3 | Reused Ticket/Button/Badge system, but `size="sm"` buttons break the 44px touch-target rule in Wishlist |
| 5 | Error Prevention | 3 | zod-validated checkout, COD auto-switches when ineligible |
| 6 | Recognition Rather Than Recall | 4 | Saved addresses, sticky order summary, lead-time chart always visible |
| 7 | Flexibility and Efficiency | n/a | Persuade-mode home; ~3 on Operate pages (shop/checkout) |
| 8 | Aesthetic and Minimalist Design | 3 | Hero is tight; Work Orders section is the one dense spot |
| 9 | Error Recovery | 3 | ErrorNote + retry pattern used consistently |
| 10 | Help and Documentation | n/a | Persuade-mode home; ~2 at checkout (no inline FAQ) |
| **Total** | | **27/32** | **Good (84%)** |

## Design Specificity Verdict

**LLM assessment**: High specificity. This is not swappable with another store. The conveyor thread computes real DOM geometry per breakpoint and lights exactly one station in rose as you scroll (`ConveyorThread.tsx`) — a literal build of the "one live thing" brand rule, not a metaphor bolted on after the fact. Rubber stamps differentiate status by shape as well as colour (`Stamp.tsx`), which is an accessibility decision baked into a brand primitive. Checkout reassurance copy is specific to this business model (50% deposit, COD-to-online fallback), not generic trust badges.

**Deterministic scan**: `impeccable detect` found 0 static findings, but the live-render URL scan flagged 25-28 issues per page (details below), dominated by two clusters: (1) contrast/opacity findings on hero subhead, sample-photo captions, price tags, and 7-11 `<img>` elements per page — all traced to `globals.css:196-258`'s scroll-reveal system, which sets `opacity: 0` on `[data-reveal][data-armed]:not([data-in])` until an element scrolls into view. The detector's headless capture ran before scroll, so it saw pre-reveal states. **This is a false-positive class, not a real defect** — confirmed by reading the CSS: content is stated to be "visible by default; JS arms them after mount." (2) One real, unrelated finding survives: `/shop` has an `<h1>"The shelf"` followed directly by `<h3>"Mug Rug"` with no `<h2>` — a genuine heading-order accessibility issue. The 7 `text-occlusion` hits on `/shop` are also likely false positives (a transparent stretched-link `a::after` full-card overlay, not real occluding text) — worth a quick visual confirm but not treated as a defect here.

**Visual overlays**: Not available — Chrome extension wasn't connected this session, so no `[Human]` tab overlay exists. Both assessments fell back to source reading plus the detector's Puppeteer live-render scan (which does hit real computed styles, just pre-scroll).

## Overall Impression

The site is unusually well-authored for this category — the brand metaphor is structural, not decorative, and it shows up in real engineering (breakpoint-aware thread geometry, shape-coded stamps, truncation logic that gives way in the right order). The biggest opportunity isn't taste, it's discipline: one section (Work Orders) is overloaded relative to the rest of the page's restraint, one component family (buttons) has a touch-target regression in exactly the surface where users convert a saved item to a sale, and one page (`/shop`) has a real heading-order gap.

## What's Working

1. **The conveyor thread** — scroll-computed, breakpoint-aware, `aria-hidden`, decorative-only so it never traps a screen-reader user. The single clearest embodiment of "rose is the one live thing" anywhere on the site.
2. **Shape-coded stamps** — status is never colour-only, by design, in the brand primitive itself (`Stamp.tsx`).
3. **Checkout reassurance copy** — placed exactly at the moment of highest anxiety ("Nothing is charged until you confirm," the COD WhatsApp-confirmation line), not generic trust badges.

## Priority Issues

**[P1] Work Orders section is the densest, highest-consideration section on the page**
Why it matters: it's selling the highest-stakes, least-familiar purchase type (a custom commission) and asks the reader to hold ~8-9 discrete pieces of information (4 steps + a 3-column quote grid + 3 stamps + a disclaimer) at once, well past the project's own ≤4-item working-memory guidance.
Fix: collapse the 4-step list to 3 (merge "get a quote" and "say yes, pay X%"), or move the illustrative ticket's quote/deposit/days breakdown behind a lighter first read so the stamps aren't competing with the numbers on first paint.
File: `web/src/components/home/WorkOrders.tsx:32-102`
Suggested command: `$impeccable layout`

**[P1] Touch-target regression in Wishlist — inconsistent with the site's own 44px rule**
Why it matters: `WishlistClient.tsx` uses `size="sm"` (36px, `Button.tsx:20`) for "Add to cart"/"Choose options" with no `min-h-11` override, while the adjacent "Remove" button on the same row correctly gets `min-h-11 min-w-11`. Two buttons on the same row read as unequally tappable, on the exact row where a saved item converts to a sale, and it's the only place this regression appears — `AddressesClient.tsx` gets it right elsewhere.
Fix: bump to `size="md"` or add `min-h-11`, matching the pattern already used in `AddressesClient.tsx`.
File: `web/src/components/account/WishlistClient.tsx:83-96`
Suggested command: `$impeccable audit`

**[P1] `/shop` skips a heading level (h1 → h3, no h2)**
Why it matters: real accessibility/structure defect, confirmed by live-render scan, not a false positive. Screen-reader users navigating by heading lose the "section" landmark between page title and product name.
Fix: insert an `<h2>` (visually hidden if needed) for the product-grid region, or demote product-name headings to match whatever level "The shelf" actually sits at in the outline.
File: `web/src/app/(store)/shop` client/grid component (product card heading level)
Suggested command: `$impeccable audit`

**[P2] Custom Work Orders home copy shows only the happy path of the quote state machine**
Why it matters: the product's own rules let admin counter or decline a quote, but the home page's steps and example ticket only show Requested → Quoted → Accepted. A first-time visitor doesn't learn what happens if the price doesn't work for them — the actual point of highest anxiety before committing to a non-returnable-feeling custom purchase.
Fix: add a muted "Countered" stamp state to the example ticket, or one reassurance line near the CTA ("Not quite right? We'll counter or you can walk away — no obligation").
File: `web/src/components/home/WorkOrders.tsx:11-16, 86-94`
Suggested command: `$impeccable clarify`

**[P2] `ShippingDock` conflates two different user intents in one station**
Why it matters: rates/policy (informational, prospect-facing) and order tracking (transactional, returning-customer-facing) share one visual frame. A returning customer tracking an order scrolls past four rate facts first; a prospect reading rates sees an irrelevant tracking form.
Fix: split into two distinct blocks, or lead with whichever intent is more common and let the other collapse/expand.
File: `web/src/components/home/ShippingDock.tsx:22-73`
Suggested command: `$impeccable layout`

**[P3] Shelf category hover-reveal has no mobile equivalent**
Why it matters: the desktop hover peek (product image slide-in) is the section's most crafted interaction, but it's `hidden … md:block`-gated, so most of the stated target audience (mid-range Android phones) never sees it — mobile gets stencil text only.
Fix: a lighter static-thumbnail treatment on mobile so feel, not just function, has parity across breakpoints.
File: `web/src/components/home/Shelf.tsx:51-56`
Suggested command: `$impeccable adapt`

## Persona Red Flags

**Jordan (Confused First-Timer)**: Scrolls past the Work Orders 4-step list and still doesn't know the full outcome space (what if the quote's too high?) or when they'll hear back — no SLA copy anywhere in `STEPS`. Combined with the section's density (P1), this is the persona most likely to bail before ever submitting a work order.

**Sam (Accessibility-Dependent User)**: Generally strong — focus-ring token system with dark-surface override, shape-coded stamps, aria-live regions — but the Wishlist touch-target gap (P1) is a concrete, testable failure for a low-vision or motor-impaired mobile user on exactly the page where they're converting a saved item into a purchase. The `/shop` heading-order gap (P1) also costs this persona a navigable landmark.

**Casey (Distracted Mobile User)**: The Shelf's mobile category rows lose the richest recognition cue (image peek) that helps a distracted scroller recognize a category at a glance — text-only recognition costs more attention than image recognition for this persona.

## Minor Observations

- `Ticket`'s head-truncation logic (text gives way before a badge does) is a reusable pattern worth applying anywhere else truncation shows up.
- `Badge` "sample" tone is explicitly dev-only-commented, consistent with the project's placeholder-registry discipline.
- Hero's tape marquee repeats "Ships worldwide"/COD messaging that also appears in `ShippingDock`'s facts list one full scroll later — minor redundancy, candidate for trimming tape items to purely novel information.
- Checkout's numbered `Section` scheme (1-6 including the sidebar) reinforces the "job ticket, step by step" metaphor even off the home page — worth keeping as the pattern for any future multi-step flow.
- Detector's `cream-palette` and `marquee` flags are the tool's generic "AI slop" heuristics firing on choices that are explicit, named brand rules here (cream ground, tape marquee) — not real findings, no action needed.
