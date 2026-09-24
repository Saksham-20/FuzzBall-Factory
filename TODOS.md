# TODOS

## Security

### Lock down the public test site while its API runs in development mode

**What:** Make sure the test VPS uses a unique admin password and long random JWT secrets, then keep strangers out (nginx basic auth or an IP allow-list) until the API can run in production mode.

**Why:** In development mode the API exposes the public mock-payment confirm route, skips the JWT secret strength check, and the seed falls back to the sample admin password unless `ADMIN_PASSWORD` is set. The source is public, so anyone can read how.

**Context:** `docs/DEPLOY_VPS.md` explains why the test API runs `NODE_ENV=development` (HTTP only, so production's `Secure` cookies would break login; mock payments need non-production). The real address and SSH details are in `docs/DEPLOY_VPS.local.md` (gitignored). The server shares its box with another live site, so an admin takeover there reaches further than test data. Moving to a domain with HTTPS lets the API switch to production and closes all three.

**Effort:** S
**Priority:** P1
**Depends on:** None

### Turn off SSH password login on the VPS

**What:** Set `PasswordAuthentication no` and `PermitRootLogin prohibit-password` in `sshd_config`, then reload sshd.

**Why:** The server offers password login for root (a refused key reports `Permission denied (publickey,password)`), which invites brute force on a box that also serves a live site.

**Context:** Key login already works. Keep a second SSH session open while reloading, so a mistake can't lock you out.

**Effort:** S
**Priority:** P2
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

### Home page reads the mock catalogue even in real-API mode

**What:** `Shelf.tsx` and `MakerNote.tsx` import `@/lib/mock/catalog` directly, so `NEXT_PUBLIC_USE_MOCK=false` still shows sample pieces on the home page.

**Why:** Once real products exist, the home page would keep showing the samples.

**Context:** Route home data through `lib/api` like the shop does. The door-word sizing in `Shelf.tsx` then sees real category words, so measure the rendered word instead of the per-letter estimate (see `MODAK_EM_PER_LETTER`).

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

### Address labels: the API allows 40 characters, the form 30

**What:** `SaveAddressDto.label` is `@TrimmedString(1, 40)` (`api/src/account/dto/account.dto.ts:40`); the web form caps it at 30 (`AddressesClient.tsx`).

**Why:** A longer label saved through the API is cut short in the address card's ticket head.

**Context:** Set the DTO max to 30 to match the form.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Accessibility

### Footer focus ring is 2.44:1 on cocoa (FINDING-012)

**What:** The global `:focus-visible` ring is rose-deep `#9c4f55`; on the cocoa footer `#3f2619` that is 2.44:1, below the 3:1 minimum for non-text contrast, on every footer link and the WhatsApp chip.

**Why:** Keyboard users lose their place in the footer.

**Context:** `outline: 2.5px solid var(--focus-ring, var(--color-rose-deep))` in `globals.css`, and `[--focus-ring:var(--color-butter)]` on the footer. From the 2026-09-23 design audit.

**Effort:** S
**Priority:** P2
**Depends on:** None

### "Ready to ship" badge text is 4.09:1 (FINDING-013)

**What:** `--color-ok` `#4f7a45` on `--color-ok-wash` `#e1ecd6` at 11px (`components/ui/Badge.tsx`) is below 4.5:1.

**Why:** It is the label that decides purchases.

**Context:** Darken `--color-ok` to about `#466e3d`. One token.

**Effort:** S
**Priority:** P2
**Depends on:** None

### The tape marquee has no pause control (FINDING-014)

**What:** The tape loops forever and pauses only on mouse hover or the OS reduced-motion setting (`components/brand/Tape.tsx`, the `.tape-track` rule in `globals.css`); keyboard and touch users can't stop it (WCAG 2.2.2).

**Why:** Moving content that can't be paused fails WCAG and distracts readers.

**Context:** A small pause/play `<button aria-pressed>` on the tape toggling `animation-play-state`, plus pause on `:focus-within`. Pairs with `plans/004`.

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
