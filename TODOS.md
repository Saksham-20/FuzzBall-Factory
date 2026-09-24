# TODOS

## Security

### Lock down the public test site while its API runs in development mode

**What:** Make sure the test VPS uses a unique admin password and long random JWT secrets, then keep strangers out (nginx basic auth or an IP allow-list) until the API can run in production mode.

**Why:** In development mode the API exposes the public mock-payment confirm route, skips the JWT secret strength check, and the seed falls back to the sample admin password unless `ADMIN_PASSWORD` is set. The source is public, so anyone can read how.

**Context:** `docs/DEPLOY_VPS.md` explains why the test API runs `NODE_ENV=development` (HTTP only, so production's `Secure` cookies would break login; mock payments need non-production). The real address and SSH details are in `docs/DEPLOY_VPS.local.md` (gitignored). Moving to a domain with HTTPS lets the API switch to production and closes all three.

**Effort:** S
**Priority:** P1
**Depends on:** None

### Seed and config checks only run in production

**What:** `api/prisma/seed.ts` refuses the sample admin password only when `NODE_ENV === 'production'`, and `api/src/config/env.ts:47` skips the JWT secret checks outside production.

**Why:** Any internet-reachable non-production deploy, like the test VPS, runs with the published sample password unless `ADMIN_PASSWORD` is set, and with unchecked secrets.

**Context:** Require `ADMIN_PASSWORD` whenever the database isn't local, and warn loudly at boot when secrets are short or contain `change-me`, in every mode.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Order tracking puts the phone number in the URL

**What:** The tracking form submits with GET (`web/src/components/home/ShippingDock.tsx`, `web/src/app/(store)/track/page.tsx`), so `?order=…&phone=…` lands in browser history and server logs.

**Why:** The phone number is personal data, and the order + phone pair is the lookup credential: a shared link works for anyone.

**Context:** Submit with POST (a server action or route handler) and show the result without echoing the inputs into the URL.

**Effort:** M
**Priority:** P2
**Depends on:** None

## Storefront (web)

### Parts of the storefront read the mock catalogue even in real-API mode

**What:** These import `@/lib/mock/catalog` directly, so `NEXT_PUBLIC_USE_MOCK=false` still serves sample data in them: the home page (`Shelf.tsx`, `MakerNote.tsx`), the header and footer category menus, category pages (`shop/[category]/page.tsx`, which returns a 404 for any category not in the sample set), product page metadata, JSON-LD and share images (`p/[slug]/page.tsx`, `opengraph-image.tsx`), `sitemap.ts`, the shop's colour filter (`ShopClient.tsx`) and `lib/state/productCache.ts`.

**Why:** Once real products exist, these keep showing the samples and real categories return a 404. It blocks going live on real data.

**Context:** Route them through `lib/api` like the shop list does. The door-word sizing in `Shelf.tsx` then sees real category words, so measure the rendered word instead of the per-letter estimate (see `MODAK_EM_PER_LETTER`).

**Effort:** M
**Priority:** P2
**Depends on:** None

### Credit the sample photos

**What:** `web/public/samples/PROVENANCE.md` lists `mice.png` (the file is `mice.jpg`) and names no authors, but several photos are CC BY / BY-SA, which require attribution wherever they are shown.

**Why:** The public test site shows them.

**Context:** Add author and licence per file plus a credits line (footer or /about), or replace them with the maker's own photos, which are coming anyway.

**Effort:** S
**Priority:** P2
**Depends on:** None

### Account pages scroll sideways on small phones

**What:** Four account pages are wider than a 320px screen (sample data unless noted):
- `/account/orders`, 33px: the screen-reader text `, order FB-…` (`web/src/components/account/OrdersClient.tsx:74`) sits inside a truncated paragraph but is absolutely positioned against the ticket, so the paragraph's clipping doesn't contain it.
- `/account/custom/[wo]`, 67px (27px at 360px): the Attach photo / Send message row (`web/src/components/account/custom/MessageThread.tsx:116`) doesn't wrap and widens the single-column grid in `WorkOrderDetail.tsx:113`.
- `/account`, 3px, and 190px with a long work order title (the form allows 60 characters): the grid sections in `web/src/components/account/OverviewClient.tsx:73` and `:96` have no `min-w-0` below md, so a truncated title still counts at full width.
- `/account/orders/FB-1023`, 3px: the "Ask about this order on WhatsApp" button (`OrderDetailClient.tsx:248`) doesn't wrap.

**Why:** Sideways scroll makes the whole page wobble under the thumb, on the pages customers use after buying.

**Context:** The address list had the same grid bug and was fixed with `min-w-0` on its items (`AddressesClient.tsx`). Fixes: move the order number into the link's accessible name or outside the truncated `<p>`; `flex-wrap` on the button rows; `min-w-0` on the overview sections. Then extend the e2e "never scrolls sideways" check to signed-in pages (the address-card spec shows the mock sign-in).

**Effort:** S
**Priority:** P2
**Depends on:** None

### Address labels: the API allows 40 characters, the form 30

**What:** `SaveAddressDto.label` is `@TrimmedString(1, 40)` (`api/src/account/dto/account.dto.ts:40`); the web form caps it at 30 (`AddressesClient.tsx`).

**Why:** A longer label saved through the API is cut short in the address card's ticket head.

**Context:** Set the DTO max to 30 to match the form.

**Effort:** S
**Priority:** P3
**Depends on:** None

### The tape runs out of words on wide screens

**What:** `web/src/components/brand/Tape.tsx` renders its words twice and the loop moves the track by one copy, so the strip stays full only while one copy is at least as wide as the tape. One copy is about 1,110px on the home page and 990px on the sign-in panel. On a 1440px screen the right end of the home tape runs bare for about a third of every 42-second loop (up to 360px of empty tape); at 1920px for three quarters of it; at 2560px all the time.

**Why:** Bare tape at the end of the strip reads as a glitch on the hero, at the widths most laptops and desktops have.

**Context:** Render four copies and move the track by `-25%` instead of `-50%` (the `tape` keyframes in `globals.css`): the same speed, and the strip stays full up to about 3,300px. Keep the extra copies `aria-hidden` like the second one. `plans/004` adds `data-loop` to the same `.tape-track` element.

**Effort:** S
**Priority:** P2
**Depends on:** None

## Motion

### Run the animation plans (plans/001–005)

**What:** Five self-contained plans for the storefront's existing motion: `.press` swallowing hover transitions, calmer and earlier reveals, the station-node stamp, pausing off-screen loops, and the header's animated blur.

**Why:** 001 alone brings back every eased hover on the site; the rest are smaller feel and performance fixes.

**Context:** `plans/README.md` gives the order and the line references (anchored on quoted code). Each plan has its own feel check.

**Effort:** M
**Priority:** P2
**Depends on:** None

### Thread start measured before the ball settles; font-ready rebuild outlives the page

**What:** `ConveyorThread.tsx` measures the thread's start while the hero ball's 900ms entrance may still be running and never re-measures it, and its `document.fonts.ready` callback isn't cancelled on unmount.

**Why:** The thread can start a few pixels off the ball's tail, and a late callback runs `build()` on a torn-down component.

**Context:** Re-run `build()` once the entrance ends (`animationend` on `.hero-ball`), and guard the fonts callback with a disposed flag in the effect cleanup.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Infrastructure

### The web env template never ships

**What:** `web/.gitignore` ignores `.env*`, which also catches `.env.example`.

**Why:** Anyone cloning the repo gets no list of the web's environment variables.

**Context:** Add `!.env.example` after the `.env*` rule, and check the example holds no real values before committing it.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Completed

### Turn off SSH password login on the test server

**What:** The test server now accepts SSH keys only; password login is off.

**Why:** Password login on an internet-facing server invites brute-force attempts.

**Context:** Key login already worked. The setting, the file that holds it and how to undo it are in `docs/DEPLOY_VPS.local.md` (gitignored).

**Effort:** S
**Priority:** P2
**Depends on:** None

**Completed:** 2026-09-24 (not versioned yet)

### Footer focus ring is 2.44:1 on cocoa (FINDING-012)

**What:** The global `:focus-visible` ring was rose-deep `#9c4f55`; on the cocoa footer `#3f2619` that is 2.44:1, below the 3:1 minimum for non-text contrast, on every footer link and the WhatsApp chip.

**Why:** Keyboard users lost their place in the footer.

**Context:** The ring now reads `var(--focus-ring, var(--color-rose-deep))` in `globals.css`. The footer and the admin bulk-actions bar (also cocoa) set `[--focus-ring:var(--color-butter)]`: 9.1:1. `e2e/a11y.spec.ts` measures it.

**Effort:** S
**Priority:** P2
**Depends on:** None

**Completed:** 2026-09-24 (not versioned yet)

### "Ready to ship" badge text is 4.09:1 (FINDING-013)

**What:** `--color-ok` `#4f7a45` on `--color-ok-wash` `#e1ecd6` at 11px (`components/ui/Badge.tsx`) was below 4.5:1.

**Why:** It is the label that decides purchases.

**Context:** `--color-ok` is now `#466e3d`: 4.83:1 on the wash, and darker everywhere else the token is used. `e2e/a11y.spec.ts` measures the shop badges.

**Effort:** S
**Priority:** P2
**Depends on:** None

**Completed:** 2026-09-24 (not versioned yet)

### The tape marquee has no pause control (FINDING-014)

**What:** The tape looped forever and paused only on mouse hover or the OS reduced-motion setting; keyboard and touch users couldn't stop it (WCAG 2.2.2).

**Why:** Moving content that can't be paused fails WCAG and distracts readers.

**Context:** `components/brand/TapeToggle.tsx`: a pause button (`aria-pressed`) on the tape at the page's left content edge, clear of the WhatsApp button, remembered across pages and hidden under reduced motion, where the tape is already still. Pointing at the words still holds them. No pause on `:focus-within`: with the button focused, pressing play would not visibly restart the tape. The sign-in panel was hidden from screen readers as a whole; now its pieces are, so the button stays reachable. `plans/004` is updated to leave the button's state alone.

**Effort:** S
**Priority:** P2
**Depends on:** None

**Completed:** 2026-09-24 (not versioned yet)
