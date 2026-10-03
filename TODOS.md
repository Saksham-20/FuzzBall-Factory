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

### Support attachments from the website forms

**What:** The API takes up to 4 uploaded photos on a ticket from a signed-in sender (and on admin replies), but the website's ticket forms and reply boxes have no attach button.

**Why:** Damage claims and grievances are easier to settle with photos. Today customers must reply to the email or use WhatsApp. Guests cannot upload at all (uploads need login), so guest tickets would need a signed upload link or a different route.

**Effort:** M
**Priority:** P2
**Depends on:** None

### DPDP core duties (target 2027-05-13; start 2027-03)

**What:** Re-read the Digital Personal Data Protection Rules 2025 (Gazette G.S.R. 846(E)) and confirm the commencement date, then: extend `audit.scrub-ips` and `auth.scrub-token-meta` retention to at least 1 year (change `privacy.tsx` and `DATA_RETENTION.md` in the same change); write the breach runbook (notify affected people without delay and the Data Protection Board within 72 hours) in `docs/RUNBOOK_OPS.md`; state the maximum response time for access requests (30 days) on the privacy page.

**Why:** Log retention below a year will be non-compliant once the core duties apply, and the policy text and the code must say the same.

**Effort:** M
**Priority:** P1 (date-driven)
**Depends on:** `docs/LEGAL_REVIEW.md`

### E-Commerce Amendment Rules 2026 (in force 2027-01-01; build in December 2026)

**What:** (1) Confirm the Gazette text. (2) The "was" price must be the lowest of the previous 30 days: add a price-history table or remove the strike-through. (3) Register on the National Consumer Helpline convergence programme (owner action), then mention it on the grievance page. (4) Have the owner sign the first dark-pattern audit (`docs/DARK_PATTERNS_AUDIT.md` is a code walk-through only), then set `LEGAL.darkPatternAudit` in `web/src/lib/legal.ts`. (5) Repeat the audit every year and before any new checkout or promotion feature. (6) A copy of the complaint as recorded is already sent by `ticket.received`; verify it.

**Why:** The rules are reported to need these from 2027-01-01.

**Effort:** M
**Priority:** P1 (date-driven)
**Depends on:** Owner actions

### Razorpay sample invoice and the open legal decisions

**What:** Razorpay asks for a sample invoice and the policy pages at activation; produce a sample invoice once GST status is known. Unresolved owner decisions (details in `docs/PLAN_LEGAL_SUPPORT_WHALES.md`): character-style pieces, EU sales (GPSR, GDPR representative), toy safety or an artisan card and the Baby category, GST registration, cash on delivery, the grievance officer details, the IEC for international card payments, and a lawyer review of the pages (`docs/LEGAL_REVIEW.md` has the checklist).

**Why:** The pages keep their "draft" banner until a lawyer has signed them off.

**Effort:** S
**Priority:** P1
**Depends on:** The maker

## Reliability

### The admin dashboard files early-morning orders under the previous day

**What:** `api/src/admin/admin-dashboard.service.ts` buckets revenue per IST day with `("createdAt" AT TIME ZONE 'Asia/Kolkata')::date`. `createdAt` is a `timestamp` without time zone holding UTC, so that reads the UTC clock as if it were IST and moves each order 5h30 the wrong way. An order paid after midnight IST lands on the day before for at least the first 5h30 of every day (11h when the database session runs in UTC), so "Today" revenue reads ₹0 every morning. `api/test/admin.e2e-spec.ts` (dashboard: counts and sums real rows) fails when run in that window; found at 00:05 IST on 2026-10-04.

**Why:** The maker reads "Today" first thing; it is wrong for a large part of every day, and the test passes or fails by the clock.

**Context:** Convert from UTC first: `(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date`. Add a regression case that creates a paid order at 00:05 IST today, so the old SQL fails the test at any hour. API-only redeploy (restart `fuzzball-api`).

**Effort:** S
**Priority:** P1
**Depends on:** None

### Work-order emails still poll for their transaction to commit

**What:** Write the email outbox row inside the same database transaction as the state change, so `CustomStateService.dispatchWhenCommitted` (a chain of `setTimeout` checks for the timeline event) can go.

**Why:** The outbox makes delivery durable once a message is queued, but the work-order paid handler still queues it only after polling for the commit. A crash in that window loses the email.

**Context:** `api/src/custom/custom-state.service.ts` (`dispatchWhenCommitted`), `api/src/notifications/email-outbox.service.ts`. Needs `enqueue(tx, ...)` and the payments module to hand its transaction to paid listeners.

**Effort:** M
**Priority:** P2
**Depends on:** None

## Storefront (web)

### Product structured data has no return policy or shipping details

**What:** The Product JSON-LD (`web/src/app/(store)/p/[slug]/page.tsx`) carries name, price, availability and images, but not `hasMerchantReturnPolicy`, `shippingDetails` or `priceValidUntil`. Google's Merchant listings report shows them as optional gaps.

**Why:** The refund and shipping policy pages are still drafts with placeholder numbers (return window, courier charges). Publishing figures in structured data before the maker confirms them would be an invented claim.

**Context:** Once `docs/PLACEHOLDERS.md` shows the refund and shipping policies as final, derive both blocks from the same constants the policy pages use. Set the same shipping and return rules in Google Merchant Center for the `/feed/google.xml` feed (they are account-level there).

**Effort:** S
**Priority:** P2
**Depends on:** Maker confirms return window and shipping rates

### Overseas orders have no export invoice or GST treatment

**What:** Orders to addresses outside India are priced, taken online and shipped, but no invoice is produced, and nothing records the export treatment (zero-rated under a Letter of Undertaking, or IGST paid with a refund claim). The courier also needs a commercial invoice and customs declaration with the parcel.

**Why:** If the maker is GST-registered, exports need a proper tax invoice and LUT filing; customs abroad hold parcels without a correct declaration. This is a legal and accounting question, not a code one, so it waits for the maker's CA.

**Context:** Get the answers first (GST registration, LUT, HSN code for crochet goods, who fills the courier's export form). Then add an invoice PDF per order (`docs/PLAN.md` leaves room for a GST invoice model) with the declared value matching the order. Until then, overseas orders are handled by hand, and the shipping policy already tells buyers that duties are theirs.

**Effort:** M
**Priority:** P1 if GST-registered, else P2
**Depends on:** Maker's CA; GSTIN status

### India-only launch: the API still takes overseas orders

**What:** International shipping is switched off in the storefront (`SITE.shipsInternational`, env `NEXT_PUBLIC_SHIPS_INTERNATIONAL`, off by default): checkout and the saved-address form offer India alone and refuse an address abroad, the product page's delivery check has no country picker, and the landing page, FAQ and the shipping and pricing policies say we ship within India. The API does not know about the switch, so a hand-made request could still place an overseas order.

**Why:** The owner launches in India first (2026-10-03). A storefront that promised "worldwide" would break that promise at checkout.

**Context:** Add the same switch to the API (`PAYMENTS`-style env, or a setting), refuse non-`IN` addresses in `api/src/shipping/address-validation.ts` while it is off, and drop the "keep at least one international zone" rule in `SettingsClient.tsx` for an India-only shop. The terms and refund policy drafts still describe international orders; the lawyer review should confirm the India-only wording (`docs/LEGAL_REVIEW.md`).

**Effort:** S
**Priority:** P2
**Depends on:** None

### International launch depends on the maker's Razorpay account

**What:** Overseas cards only work once Razorpay's international payments are enabled on the maker's account (an application on top of KYC), and the test order with an international card is listed in `docs/DEPLOY_PROD.md`.

**Why:** Without it, overseas customers fail at the payment step even though checkout accepts their address.

**Context:** Ask Razorpay for international payments when applying for live access; shipping zone rates and transit windows in settings are sample numbers (`docs/PLACEHOLDERS.md`, `shipping-rates`) to confirm with the courier's real quotes per zone.

**Effort:** S (waiting time, not work)
**Priority:** P1 (blocks international at launch)
**Depends on:** Razorpay approval; real courier rate card

### Content-Security-Policy still allows inline scripts

**What:** `web/src/lib/security-headers.ts` sends `script-src 'self' 'unsafe-inline' https://checkout.razorpay.com`. Inline scripts are allowed because Next's bootstrap scripts need it without a per-request nonce.

**Why:** A nonce (generated in `proxy.ts`) forces every page to render per request, which gives up the cached catalogue pages on a small VPS. The rest of the policy is strict (no framing, no plugins, no foreign forms, connect/img/frame limited to this site, the API, Cloudinary and Razorpay), so the remaining gap is an injected inline script, and the app has no raw-HTML sinks besides two JSON-LD blocks.

**Context:** Revisit if traffic allows dynamic rendering, or once Next supports hash-based CSP for static pages. Check the PDP and checkout once against the live Razorpay window (frame/script origins) before launch.

**Effort:** M
**Priority:** P3
**Depends on:** None

### Phone landscape: the hero's buttons start below the first screen

**What:** Turned sideways (844×390, 932×430, 667×375), a phone gets the stacked hero: ball and whale ticket on top, then the headline, so the buttons sit 300-420px below the first screen. The headline already shrinks with the screen's height (`min(9.4vw, 15svh)`).

**Why:** Few shoppers browse sideways, but those who do see a ball and a ticket and no way in until they scroll.

**Context:** Give short, wide screens the side-by-side layout with a smaller ball and ticket: a custom variant such as `@media (orientation: landscape) and (max-height: 32rem)` on the hero's `lg:` classes in `web/src/components/home/Hero.tsx`, and the same test in `ConveyorThread.tsx` where it decides `stacked`, so the thread's route matches. Re-run the hero checks (thread through the hole, never climbing, clear of the copy).

**Effort:** S
**Priority:** P3
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

## Infrastructure

### The web env template never ships

**What:** `web/.gitignore` ignores `.env*`, which also catches `.env.example`.

**Why:** Anyone cloning the repo gets no list of the web's environment variables.

**Context:** Add `!.env.example` after the `.env*` rule, and check the example holds no real values before committing it.

**Effort:** S
**Priority:** P3
**Depends on:** None

## Completed

### Home door words are sized from a per-letter estimate

**What:** `Shelf.tsx` sizes the category words on the home page from their length (`MODAK_EM_PER_LETTER`). Real category words from the admin may contain wide letters (m, w) that run past the chip.

**Why:** The storefront now reads the real catalogue everywhere (server-side `lib/catalog-server.ts`), so the words are no longer the seed set the estimate was tuned for.

**Context:** Obsolete: the landing redesign removed `Shelf.tsx` and its door words; the home page shows the whales instead.

**Effort:** S
**Priority:** P3
**Depends on:** None

**Completed:** 2026-10-03 (not versioned yet)

### The tape runs out of words on wide screens

**What:** `web/src/components/brand/Tape.tsx` renders its words twice and the loop moves the track by one copy, so the strip stays full only while one copy is at least as wide as the tape. One copy is about 1,110px on the home page and 990px on the sign-in panel. On a 1440px screen the right end of the home tape runs bare for about a third of every 42-second loop (up to 360px of empty tape); at 1920px for three quarters of it; at 2560px all the time.

**Why:** Bare tape at the end of the strip reads as a glitch on the hero, at the widths most laptops and desktops have.

**Context:** `Tape.tsx` renders four copies and the `tape` keyframes move the track by one (`-25%`): the same speed, and the strip stays full up to about 2,700px on the home page (the home copy is now 915px). Measured bare tape at the worst point of the loop: 0px at 1440, 1920 and 2560 (was 557px at 1440).

**Effort:** S
**Priority:** P2
**Depends on:** None

**Completed:** 2026-10-03 (not versioned yet)

### Run the animation plans (plans/001–005)

**What:** Five self-contained plans for the storefront's existing motion: `.press` swallowing hover transitions, calmer and earlier reveals, the station-node stamp, pausing off-screen loops, and the header's animated blur.

**Why:** 001 alone brings back every eased hover on the site; the rest are smaller feel and performance fixes.

**Context:** All five ran during the landing redesign; each plan's status is DONE (2026-10-03) and `plans/README.md` records the order.

**Effort:** M
**Priority:** P2
**Depends on:** None

**Completed:** 2026-10-03 (not versioned yet)

### Thread start measured before the ball settles; font-ready rebuild outlives the page

**What:** `ConveyorThread.tsx` measures the thread's start while the hero ball's 900ms entrance may still be running and never re-measures it, and its `document.fonts.ready` callback isn't cancelled on unmount.

**Why:** The thread can start a few pixels off the ball's tail, and a late callback runs `build()` on a torn-down component.

**Context:** `ConveyorThread.tsx` rebuilds on the ball's `animationend` and guards the `document.fonts.ready` callback with a `disposed` flag set in the effect's cleanup.

**Effort:** S
**Priority:** P3
**Depends on:** None

**Completed:** 2026-10-03 (not versioned yet)

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
