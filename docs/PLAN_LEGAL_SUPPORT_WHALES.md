# Plan: legal pages, admin support system, seed removal, whale listings

Written 2026-10-03. Execute task by task, one group per session, in the order given. Each task has files, spec and "Done when". Read first: `CLAUDE.md`, `docs/LEGAL_REVIEW.md` (the legal findings and the replacement wording; do not paraphrase clauses, copy them), `docs/DATA_RETENTION.md`, `docs/PLACEHOLDERS.md`. Invoke `impeccable` + `emil-design-eng` for UI work. Next.js 16 rules in `CLAUDE.md` apply. Finish every group with `scripts/verify.sh`.

**Status 2026-10-03:** Groups A, L, S, W and D1 are built; T1/T2 are recorded in `TODOS.md` with their dates. L6 left the grievance and IP *forms* to S6. L7's consent boxes already existed (unticked). Left: the owner's open decisions below.

Decisions already made by the owner (2026-10-03):
- Seed removal covers products, sample photos, sample users and sample coupons. Keep the admin user, settings and the 8 categories.
- Support system is a **ticket inbox in admin** (stored tickets, replies by email, SLA timers, customer view, grievance register).
- Legal: research-backed rewrite plus a lawyer checklist. The draft banner stays until the owner confirms lawyer review.
- Ships internationally at launch.

Not yet answered (build as switchable, never hard-code a guess): GST registered or not; COD offered or not; whether baby or under-3 items are sold; whether character-style pieces are sold (see Open decisions).

## Order

1. Group A: seed removal and clean empty states (A1-A5)
2. Group L: legal foundation and page rewrite (L1-L7)
3. Group S: support system (S1-S7)
4. Group W: whale listing support (W1-W2)
5. Group T: dated follow-ups (T1-T2), then docs (D1)

A before L (the pages shouldn't mention sample data), S after L (the grievance and contact pages submit into S). W can go any time after A.

---

## Group A: remove seeded data

### A1. API seed stops creating sample data (DONE 2026-10-03, with A2)
Files: `api/prisma/seed.ts`, delete `api/prisma/seed-data/catalog.ts`, new `api/prisma/seed-data/categories.ts`, `api/prisma/schema.prisma` + migration.
- `seed.ts` seeds only: admin user, settings, counters, **categories**. Remove `seedSampleUsers`, `seedCatalogue` (products), `seedCoupons`, the `withSamples` switch and `SEED_SAMPLES`. Keep the production guard on `ADMIN_PASSWORD`.
- Move the 8 categories into `seed-data/categories.ts` (slug, name, word, blurb). **Done differently from first drafted:** `Category.image` stays a required string (making it nullable touched every consumer). The starter shelves point at the maker's own photos under `/maker/` (Keychains & Charms uses `whale-pod.jpg`), and the upload guard accepts `/maker/` paths so admin can re-save a shelf unchanged. Empty shelves are hidden (A5), so those covers only show once a shelf has a product.
- Upsert categories by slug with `update: {}` so admin edits are never overwritten (current code overwrites; change it).
- Leave `Product.sample` column in place (admin UI badge still reads it); no new data sets it.
Done when: `npm run seed` on an empty DB gives admin, settings, counters, 8 categories and zero products, users (other than admin) or coupons; running it twice changes nothing; `npm run build && npm run lint && npm test` pass; e2e suites that relied on seeded products are updated to create their own fixtures (see A4).

### A2. One-off purge for databases that already hold the samples (DONE; `api/src/maintenance/purge-samples.ts`, test `api/test/purge-samples.e2e-spec.ts`)
Files: new `api/scripts/purge-samples.ts`, `api/package.json` script `purge-samples`, `docs/DEPLOY_VPS.md` note.
- Deletes: products with `sample = true` (variants and images cascade; `OrderItem.productId` is `SetNull`, so past orders keep their snapshots), the three seeded users by exact email (`maya@example.com`, `arjun@example.com`, `sophie@example.com`) with their addresses and any orders, **only if** those orders have no real payments; coupons `FIRSTFUZZ`, `GIFT100`, `EXPIRED20` when `uses` matches the seeded values or all of their redemptions belong to the purged users. Writes an `AuditLog` row. Refuses to run unless `--yes` is passed and prints a dry-run list first.
- Never deletes the admin or any user with a real Razorpay payment. Verify FKs (Review, WishlistItem, CustomRequest) before writing the deletes; add a test in `api/test/`.
- **Do not run it on production or the test VPS yourself.** The owner approves per `feedback_run-deploys-end-to-end`: deploys are done end to end, but ask before server data changes. Print the exact command in the final message.
Done when: against a seeded test DB the dry run lists exactly the sample rows; with `--yes` they are gone and a second run reports zero.

### A3. Web: delete sample products and stock photos (DONE 2026-10-03)
Files: `web/src/lib/mock/catalog.ts`, `web/src/lib/mock/db.ts`, `web/src/lib/catalog-server.ts`, `web/public/samples/` (delete the folder), `web/public/samples/PROVENANCE.md` (deleted with it), `web/src/app/(store)/about/page.tsx`, `web/src/components/home/HookFloor.tsx`, `ShippingDock.tsx`, `WorkOrders.tsx`, `web/src/lib/google-feed.ts`, `web/src/lib/image-loader.ts`.
- Grep for `/samples/` and `sample` and resolve every hit: either a maker photo from `web/public/maker/` or a drawn fallback. About page photo (`PLACEHOLDER(sample-photo)`): done: `/maker/crew-hedgehog.jpg`. **Do not use `/maker/table-full.jpg` on new surfaces:** it shows a Snorlax-style character plush (see Open decision 1); it is still on the home page in `HookFloor.tsx`, which is the owner's call.
- Mock mode keeps a tiny fixture so dev and e2e still run: **4 whale products** (red, yellow, blue, pink; one category `keychains`) with stills from `/maker/clips/whale-*.jpg`, price and lead time tagged `PLACEHOLDER(catalogue)` and `sample: true`. No other products. Categories stay (8).
- Mock `db.ts`: remove sample users, orders, coupons, reviews, work orders that mention sample products. Keep the sample admin login only in mock mode. Update `LoginForm.tsx` "Sample logins" hint if the logins change.
- Remove the `catalogue` / `sample-photo` rows (or narrow them to the whale fixture) in `docs/PLACEHOLDERS.md`. Delete the TODOS.md item "Credit the sample photos".
Done when: `grep -rn "/samples/" web/src web/public` returns nothing; `NEXT_PUBLIC_USE_MOCK=true npm run build`, `npm run lint`, `npm test` pass; footer "Show placeholder tags" no longer marks any stock photo.

### A4. Fix tests that leaned on the old catalogue (DONE 2026-10-03)
Files: `web/e2e/*.spec.ts`, `web/src/lib/*.test.ts`, `api/test/catalog.e2e-spec.ts`, `api/src/**/*.spec.ts` that import seed data.
- Replace references to old slugs/emails/coupons with the whale fixture (web) or fixtures created inside the test (api). Do not re-introduce a shared 15-product seed.
Done when: `scripts/verify.sh` passes, including `npm run test:e2e` in `web/` and `npm run test:e2e` in `api/`.

### A5. Empty states (no products yet) (DONE 2026-10-03)
Files: `web/src/app/(store)/shop/**`, `web/src/components/shop/*`, `web/src/components/home/YarnRoom.tsx`/category door component, header and footer menus.
- Hide categories with zero published products from menus, the home category doors and `/shop` filters. Category pages with zero products render a calm empty state, not a 404.
- `/shop` with zero products: heading "The whales are on their way", one line, buttons "Start a work order" (`/custom`) and WhatsApp. No fake counts, no countdown, no "notify me" email capture (would need consent and storage).
- Home `WhalePod` primary action points to `/custom` and WhatsApp until a whale product exists; once the "keychains" category has a published product it links to `/shop/keychains`. Decide this at render time from `serverProducts`.
- Sitemap and Google feed (`google-feed.ts`) must tolerate an empty catalogue.
Done when: with zero published products every page renders with no layout break, no console error, and the e2e a11y suite passes on `/shop`.

---

## Group L: legal foundation and page rewrite

### L1. Legal identity in one place (DONE 2026-10-03)
Files: new `web/src/lib/legal.ts`, `web/src/components/content/SellerDetails.tsx`, `Placeholder.tsx`, `policies/*.tsx`, `contact/page.tsx`, `about/page.tsx`, footer.
- One typed object `LEGAL` with every field the owner will supply: `legalName`, `constitution` (proprietorship etc.), `address` (lines), `gstin | null`, `gstRegistered`, `phone`, `customerCareHours`, `jurisdictionCity`, `grievance: { name, designation, email, phone, hours }`, `ipContactEmail`, `euRepresentative | null`, `artisanCardNo | null`. Every value starts `null`; render with `<Ph>` while `null` so the launch gate (`PLACEHOLDER(legal-details)`) still fails the build.
- Replace all inline `<Ph>[…]</Ph>` literals in policy files with reads from `LEGAL`. No other file may hold these values.
- A server helper `legalReady()` returns false while any required field is `null` (used by L7).
Done when: grep finds no `[Legal business name]`-style literals outside `legal.ts`; filling the object in one file updates every page; the launch-gate scan still lists the placeholder.

### L2. Terms and conditions rewrite (DONE 2026-10-03)
File: `web/src/components/content/policies/terms.tsx`. Apply `docs/LEGAL_REVIEW.md` section 3 "terms.tsx" items 1-8 verbatim where wording is given.
- 18+ only; liability clause; custom-order cancellation and abandoned-order clause; consumer-rights savings under CPA s.34(2)(d); IP section replaced by a short pointer to `/policies/ip`; add severability, entire agreement, electronic contracts, consent to email/WhatsApp contact, force majeure, account suspension.
- Tax wording reads `LEGAL.gstRegistered`: registered shows "prices include GST, tax invoice issued"; unregistered shows "prices are final; bill of supply issued; no GST charged". Never show GST when unregistered.
- Deposit % from `SAMPLE_SETTINGS` stays dynamic.
Done when: every item in the review's terms list is visibly addressed (checklist in the PR description) and the page keeps its table of contents working.

### L3. Cancellation and refund rewrite (DONE 2026-10-03)
File: `policies/refund.tsx` and `web/src/components/shop/ProductDetails.tsx` (`pdp-returns-copy`). Apply review section 3 "refund.tsx" items 1-6.
- Two windows stated plainly: 7 days for transit damage or wrong item, 30 days for manufacturing defect. Unboxing video is "helpful, not required".
- Made-to-order: free cancellation before production starts; after that costs incurred only, itemised in writing.
- EU/UK paragraph with the Art 16(c) wording.
- Product page copy must match this page; derive both from a shared constants file `web/src/lib/policy-constants.ts` (return windows, cancellation window) so they cannot drift. The TODOS JSON-LD item (hasMerchantReturnPolicy) can then be done from the same constants; leave it in TODOS.
Done when: product page and policy page show the same numbers from one source; unit test asserts the constants are used in both.

### L4. Shipping policy updates (DONE 2026-10-03)
File: `policies/shipping.tsx`, `ShippingRates.tsx`. Apply review section 3 "shipping.tsx".
- Risk-of-loss line, duties examples (EU EUR 3, US de minimis suspended), refusal clause, sanctions line, EU responsible-person block rendered only when `LEGAL.euRepresentative` is set, remove unboxing condition.
Done when: no remaining text makes the unboxing video a condition (`grep -ri "unboxing" web/src` reviewed).

### L5. Privacy policy update (DONE 2026-10-03)
File: `policies/privacy.tsx`, plus new `web/src/components/content/CollectionNotice.tsx`.
- Apply review section 3 "privacy.tsx" items 2-9. Item 1 (log retention) is deferred to T1.
- `CollectionNotice`: a short, plain notice (what we collect here, why, link to the policy, how to withdraw or complain) rendered at: signup, checkout, work-order form, contact and support forms, grievance form. Replace the current ad-hoc sentence in `ContactForm.tsx`.
- Processors list: Razorpay, Resend, Cloudinary, courier, host, each linked to its own policy. Add a "Support requests" row (name, email, phone, message, attachments, order link; kept 3 years after closing; see S1).
- GDPR/UK addendum section titled for EU/UK/EEA residents, with Art 15-22 rights, supervisory authority complaint, and the representative from `LEGAL.euRepresentative` (omitted if null).
- Remove the marketing opt-in promise (no marketing at launch). Add `TODOS.md` entry if marketing is later wanted.
- Withdrawal control: account page already has export and delete request; add a "Privacy and data" card linking them, so withdrawal is as easy as consent.
Done when: every collection form shows `CollectionNotice`; privacy page has no promise the UI does not keep; `DATA_RETENTION.md` row added for support tickets (S1 does the code).

### L6. Grievance page, new Pricing and IP pages, FAQ (DONE 2026-10-03)
Files: `policies/grievance.tsx`, new `policies/ip.tsx`, new `policies/pricing.tsx`, `policies/types.ts` (add slugs `ip`, `pricing`), `policies/index.tsx`, footer links, `sitemap`, `content/faq.tsx`.
- Grievance: exact wording from review section 3 "grievance.tsx"; officer block from `LEGAL.grievance`; separate customer-care block; National Consumer Helpline mention; "copy of your complaint as recorded" (effective 2027-01-01, write it now, it is harmless early); the "File a grievance" form is wired in S6. Include a dark-pattern audit certificate block **rendered only when an audit date exists** in `LEGAL.darkPatternAudit` (null at launch).
- IP page: use the review section 4 clause verbatim; contact `LEGAL.ipContactEmail`; the IP form is wired in S6.
- Pricing page (Razorpay): states all prices in INR, whether tax is included (from `LEGAL.gstRegistered`), shipping charges (from settings), deposit rule for work orders, gift wrap and COD fee if COD enabled. Read numbers from `SAMPLE_SETTINGS` now; admin settings later.
- FAQ: add "licensed/official characters?" and "copy a character?" answers (No), EU/UK withdrawal answer, revisit the baby-safety answer after Open decision 3. Answers written from the owner's real stance only.
- Update `PolicyDoc["slug"]` users: grep `POLICY_SLUGS|getPolicy` and fix route generation, metadata, footer list, sitemap.
Done when: `/policies/ip` and `/policies/pricing` exist, are in footer and sitemap, pass the a11y e2e; the Razorpay checklist (About, Contact, Pricing, Terms, Privacy, Refund, Shipping) all resolve.

### L7. Product page legal block, price display, consent checkboxes (DONE 2026-10-03)
Files: `ProductDetails.tsx`/`BuyBox.tsx`, `ProductEditor.tsx` (admin), schema + migration, signup and checkout forms, `RefundPanel`/price components.
- Legal Metrology: each product page shows a "Product details" list: net quantity (`1 piece` default, editable per product), dimensions, price "MRP, inclusive of all taxes" (or "no GST charged"), maker name and address (from `LEGAL`), country of origin India, customer-care contact. Add `Product.netQuantity String @default("1 piece")` and `Product.safetyNote String?` (admin editor fields; `safetyNote` shown as "Safety and age" when set; default none shown, never auto-claim an age grade).
- Original-design line on every product: "Original handmade design. Not an official product." (static copy in the product template).
- "Was" price (`compareAtPrice`): rename in admin to "Previous price (lowest price in the last 30 days)" with helper text; storefront shows the strikethrough only when set. Rule 4(13) takes effect 2027-01-01; add a TODOS entry for a real 30-day price history.
- Consent: signup and checkout terms acceptance is an **unticked** checkbox the user must tick (Rule 4(9)); no pre-ticked boxes anywhere; copy links Terms, Privacy, Refund. Verify COD fee, gift-wrap and shipping are visible before the final step (drip pricing).
- `docs/DARK_PATTERNS_AUDIT.md`: a table of the 13 CCPA patterns, what to check in this site (timers, "only N left" claims, pre-ticked boxes, hidden fees, nagging modals), result and date. Fill it by actually walking the site. Do not publish any certificate claim; the owner decides when a self-audit is signed.
Done when: product pages show the block; admin can edit the two new fields; checkout cannot proceed without the ticked box; audit doc exists with results.

---

## Group S: support system (admin-controlled ticket inbox)

Design: every contact, grievance, IP notice and logged WhatsApp/phone complaint becomes a **ticket** with a reference number, a thread, an SLA clock and an audit trail. The existing `POST /contact` (email only, nothing stored) is replaced. Mirror existing patterns: `CustomMessage` for threads, `Counter` for numbers, `NotificationsService` events for email, `AdminXService` + controller in `api/src/admin/`, `useApi` + mock/real pairs in `web/src/lib/api/`.

### S1. Data model, numbering, retention (DONE 2026-10-03)
Files: `api/prisma/schema.prisma` + migration, `api/src/support/` (module, service, mapper, dto), `docs/DATA_RETENTION.md`, `api/src/jobs/retention.service.ts`, erasure and export services.
- Models: `SupportTicket` {id, number (`SUP-0001` / `GRV-0001` / `IPN-0001` / `DSR-0001` by kind, from `Counter`), kind enum `SUPPORT|GRIEVANCE|IP_NOTICE|DATA_REQUEST`, channel enum `WEB|EMAIL|WHATSAPP|PHONE|POST`, status enum `OPEN|WAITING_CUSTOMER|RESOLVED|CLOSED`, category (free string from a fixed list), subject, name, email, phone?, userId? (SetNull), orderId? and customRequestId? (SetNull), accessTokenHash (guest link), createdAt, ackedAt?, ackDueAt (= createdAt + 48h), resolveDueAt (= createdAt + 30 days; for grievances this is the one-month legal clock), firstResponseAt?, resolvedAt?, closedAt?, resolutionNote?, recordCopySentAt?, lastActivityAt}. `SupportMessage` {id, ticketId (Cascade), author enum `customer|maker|internal`, body, attachments String[], emailedAt?, createdAt}. Indexes on `[status, resolveDueAt]`, `[kind, createdAt]`, `[userId]`.
- `SupportService.create()` computes the due dates, issues the number in one transaction, and returns the guest `accessToken` once (store only its hash).
- Retention: tickets are kept **3 years after closing**; nightly `support.purge` job in `RetentionService`/`ScheduledJobs`; row added to `docs/DATA_RETENTION.md` ("Support tickets", with the legal reason: complaint limitation and register keeping). Grievance rows follow the same 3-year mark (the legal-review minimum for the register).
- `ErasureService`: on account erasure, scrub ticket name/email/phone/message bodies/attachments to placeholders but **keep the register fields** (number, kind, channel, dates, category, status, resolution outcome) until the purge date. `AccountExportService` includes the user's tickets and messages. Add assertions in `erasure.e2e-spec.ts` and `retention.e2e-spec.ts` as `DATA_RETENTION.md` ("Adding a new kind of personal data") requires.
Done when: migration applies on a clean DB; unit tests cover number issue, due-date maths and token hashing; erasure, export and retention e2e assertions pass.

### S2. Public and customer API (DONE 2026-10-03)
Files: `api/src/support/support.controller.ts`, `api/src/contact/*` (becomes a thin wrapper), `docs/API.md`.
- `POST /support/tickets` (public, throttled 5/hour/IP, honeypot kept): `{kind: SUPPORT|GRIEVANCE|IP_NOTICE|DATA_REQUEST, name, email, phone?, category, orderNumber?, message (max 3000), attachments? (Upload ids, max 4), consent: true, website? (honeypot)}`. Validates `orderNumber` belongs to the same email when given (never reveal other customers' orders; if it does not match, store the text but do not link). Logged-in users are linked by `userId`. Returns `{number, accessToken}`.
- `POST /contact` keeps working: it now creates a `SUPPORT` ticket (category `general`) so the web form can migrate without a flag day. Update `contact.service.spec.ts` and `contact.e2e-spec.ts`.
- `GET /support/tickets/:number?token=` and `POST /support/tickets/:number/messages?token=` (guest, token-checked, throttled): view the thread, reply, upload photos. Never expose `internal` messages.
- `GET /account/tickets`, `GET /account/tickets/:number`, `POST /account/tickets/:number/messages` (logged-in, own tickets only).
- IDOR tests: another user's number or a wrong token returns 404.
Done when: e2e covers create (guest and logged-in), invalid token, reply, internal-note hiding, throttle, honeypot, and the old `/contact` path.

### S3. Emails (DONE 2026-10-03)
Files: `api/src/notifications/events.ts`, `templates/registry.ts`, `support.service.ts`.
- New events (registry is a total mapping, so add all templates): `ticket.received` (to customer: reference number, link, **a copy of the complaint exactly as recorded**, and for grievances the 48 hour / one month promise), `ticket.reply` (maker reply with link), `ticket.resolved` (resolution note, how to reopen by replying, how to escalate; for grievances the National Consumer Helpline line), `ticket.new_admin` (to the shop inbox: kind, reference, link to `/admin/support/<id>`).
- `ticket.received` is sent immediately on creation; set `ackedAt` then (this is the 48-hour acknowledgement and is auditable). Because email can fail, `ackedAt` is set when the outbox row is queued, and a failed row stays visible in `/admin/emails` as today.
- Reply-To on `ticket.new_admin` is the customer's address, as `contact.message` does today. Remove the old `contact.message` event and template once nothing uses it.
- Escape all user text (existing `renderTemplate` tests show how).
Done when: unit tests render each template; e2e shows the outbox rows for create, reply and resolve.

### S4. SLA reminders and dashboard numbers (DONE 2026-10-03)
Files: `scheduled-jobs.service.ts`, `admin-dashboard.service.ts`, dashboard UI.
- Hourly job `support.sla`: for tickets not `RESOLVED/CLOSED`, send the owner one reminder email per ticket when `ackDueAt` is within 12 hours and `ackedAt` is null, and one when `resolveDueAt` is within 5 days. Mark sent in a `slaRemindedAt` JSON or two timestamp columns to avoid repeats. Grievance tickets are never auto-closed.
- Dashboard: counts of open tickets, tickets due within 48 hours, overdue. Link to `/admin/support?filter=overdue`.
Done when: job unit test with a fake clock shows exactly one reminder per threshold; dashboard shows the three counts.

### S5. Admin API and screen (DONE 2026-10-03)
Files: `api/src/admin/admin-support.service.ts`, controller class in `admin.controllers.ts`, DTOs in `admin/dto/`, `web/src/app/admin/support/page.tsx`, `web/src/app/admin/support/[id]/page.tsx`, `web/src/components/admin/support/*`, `AdminShell.tsx` NAV (icon `LifeBuoy`, label "Support"), `web/src/lib/api/admin-support.ts` + `real/` + mock.
- API (all `@Roles('admin')`, every write audited): `GET /admin/support?status=&kind=&filter=overdue|due-soon&q=` (paged), `GET /admin/support/:id`, `POST /admin/support` (log a ticket the maker received outside the site, with `channel` WhatsApp/phone/post/email and the customer's details; sends `ticket.received` only if an email is given), `POST /admin/support/:id/messages` (`maker` reply, emailed, or `internal` note), `PATCH /admin/support/:id` (status, category, link order or work order, resolution note), `POST /admin/support/:id/resolve` (requires a resolution note; sets `resolvedAt`, emails `ticket.resolved`), `POST /admin/support/:id/reopen`.
- Screen: list with kind and status chips, SLA badge ("ack due in 5h", "resolve in 12 days", "overdue" in the danger token; no rose, reserved), search, filters. Detail page: header with reference, customer, linked order/work order (links to existing admin pages), thread, reply box with attachments, a separate visually distinct internal-notes toggle, status control, "Resolve" modal (note required), and a read-only audit trail. Add a "Log a WhatsApp or phone complaint" button (this is how the grievance register stays complete).
- Grievance register export: `GET /admin/support/register.csv?from=&to=` with fields: number, received, channel, kind, category, order, acked, copy sent, resolved, outcome. Ties to the legal-review "grievance register" requirement.
- Respect craft rules in `CLAUDE.md` (no eyebrow labels, no emoji icons) and the admin density rules from `DESIGN.md`.
Done when: Playwright admin flow passes (log ticket, reply, internal note, resolve, CSV downloads); axe passes on both pages; authz e2e proves non-admins get 403 on every route.

### S6. Storefront forms and customer view (DONE 2026-10-03)
Files: `web/src/components/content/ContactForm.tsx` (rewrite to the new API, keep honeypot and `CollectionNotice`), new `web/src/components/support/TicketForm.tsx`, `web/src/app/(store)/support/ticket/[number]/page.tsx` (guest and logged-in thread view), `web/src/app/(store)/account/support/page.tsx` (list), `lib/api/support.ts` + `real/support.ts` + mock, `lib/types.ts`.
- `/contact`: the form creates a `SUPPORT` ticket. On success show the reference number and "we emailed you a link". Remove the "sample mode" note only when the real API is on (keep for mock).
- `/policies/grievance`: "File a grievance" form (`GRIEVANCE`, requires name, email, what happened, desired outcome, optional order number and photos). `/policies/ip`: notice form (`IP_NOTICE`, requires the fields listed in the IP clause). A privacy "data request" option on the contact form category list creates `DATA_REQUEST`.
- Thread page: reachable by `?t=<token>` link from email (guest) or by login; shows status, SLA promise text, messages, reply box with attachments (reuse the upload component from the work-order thread).
- Account nav gets "Help requests".
- WhatsApp stays the fastest channel: keep the WhatsApp button, but state on the contact page that formal complaints made on WhatsApp are logged by the maker.
- Accessibility: form errors per `Field`, 44px targets, no layout shift on success.
Done when: guest and logged-in journeys work in real mode against the test API; mock mode submits to the mock store; e2e a11y passes on `/contact`, the thread page and the account list.

### S7. Docs and tests for S (DONE 2026-10-03)
Update `docs/API.md` (all routes), `docs/DATA_RETENTION.md`, `docs/PLACEHOLDERS.md` (remove `contact-form` placeholder), `CLAUDE.md` "Current state" one line. Add `docs/RUNBOOK_OPS.md` section "Support inbox": how to answer a grievance in time, how to export the register, what to do when email fails.
Done when: `scripts/verify.sh` is green end to end.

---

## Group W: whale listings

### W1. Make the listing flow easy and legally complete (DONE 2026-10-03)
Files: `docs/WHALE_LISTING.md` (new), `ProductEditor.tsx`.
- The owner lists whales through `/admin/products`. Write a one-page checklist: category `keychains`, name, price (MRP incl. taxes), fulfilment (ready or made to order, lead time), colour variants (red, yellow, blue, pink) with stock, dimensions and weight, fibre, care, `netQuantity`, optional `safetyNote`, photos (4:5, at least 2000px; use the maker's own), tagline free of character names. State: do not use names of existing characters in titles, tags, alt text or descriptions.
- Admin editor: warn (non-blocking) if a title, tag or description contains a hard-coded list of well-known trademarked character names (small list in `web/src/lib/ip-words.ts`, easy to extend). This is a guardrail, not legal clearance.
Done when: the checklist exists; creating a whale product through admin in a test shows the legal block on the product page.

### W2. Home page and clips follow the catalogue (DONE 2026-10-03)
Files: `WhalePod.tsx`, `web/src/app/(store)/page.tsx`.
- Per-colour cards link to the product page once a product with that colour exists (match on variant colour), else to `/custom`. No stock numbers, prices or "limited" claims until they exist in the catalogue.
Done when: with a seeded test whale product the cards link to it; without, they link to `/custom`.

---

## Group T: dated follow-ups

### T1. DPDP core duties (target ~2027-05-13; start 2027-03) (in TODOS.md)
Add to `TODOS.md` now with the date; build then:
- Extend log retention: `audit.scrub-ips` and `auth.scrub-token-meta` windows to at least 1 year; update `privacy.tsx` and `DATA_RETENTION.md` in the same change (the policy and the code must say the same).
- Breach runbook: notify affected users without delay and the Data Protection Board within 72 hours; add to `docs/RUNBOOK_OPS.md`.
- Publish the maximum response time for rights requests (30 days for erasure already exists; state 30 days for access) in the privacy page.
- Re-read the official Rules text (Gazette G.S.R. 846(E)) and confirm the commencement date.

### T2. E-Commerce Amendment Rules 2026 (in force 2027-01-01; build in December 2026) (in TODOS.md)
- Copy of complaint as recorded: already sent by `ticket.received` (S3); verify.
- Register on the National Consumer Helpline convergence programme (owner action); add the mention to the grievance page once registered.
- 30-day lowest price for any "was" price (L7 follow-up: price history table or remove strikethrough).
- First dark-pattern self-audit (L7 doc) signed by the owner; then the certificate block on the grievance page switches on.
- Confirm the Gazette text of the amendment.

---

## D1. Documentation closeout (DONE 2026-10-03)
- `docs/PLACEHOLDERS.md`: remove resolved rows (`catalogue` sample set, `sample-photo`, `contact-form`), add `legal.ts` fields under `legal-details`, keep `policy-draft` until the lawyer signs.
- `TODOS.md`: add T1, T2, the unresolved decisions below, the Razorpay sample-invoice requirement, price-history, and a yearly dark-pattern audit reminder.
- `CLAUDE.md` "Current state": one line each for the support system and the removal of sample data. Mention `docs/LEGAL_REVIEW.md` in "Source of truth".

---

## Open decisions (owner)

1. **Character-style pieces.** The legal review rates the risk as material (criminal exposure under Copyright Act s.63 is possible). Recommendation: do not list or market them, and keep character names out of every title, tag and alt text, until a lawyer has answered. The whales are original and are the safe lane.
2. **International shipping. DECIDED 2026-10-03: launch in India only; international comes later.** Disable all `intlZones` in admin settings before launch. The notes below apply when overseas selling is switched on.
    EU sales bring GPSR (an EU responsible person and manufacturer details on listings), a GDPR Art 27 representative, and 14-day withdrawal for non-custom items. Options: (a) ship worldwide, accept the compliance cost or risk after lawyer advice; (b) launch with India plus selected destinations by editing `intlZones` in admin settings and add EU later. Recommendation: (b) until the lawyer answers.
3. **Toy safety.** Sell plush and keychains as decorative items for adults, or as toys? Toy classification triggers EN 71/CE for the EU, CPC testing for the US and the BIS Toys QCO in India (artisan card exemption). Is there a Development Commissioner (Handicrafts) artisan card? Does the shop sell anything for under 3s (the "Baby" category)? Recommendation: hide the Baby category until answered.
4. **GST.** Registered or not? Decides tax wording, invoice type, LUT for exports. Ask the CA about the handicraft exemption.
5. **COD.** Offered at launch? If yes the refund wording needs a bank-transfer refund line.
6. **Who is the grievance officer, and the IEC.** Owner supplies `LEGAL` values (L1) and obtains an IEC from DGFT for international card payments.
7. **Lawyer.** Who reviews, and by when? Checklist in `docs/LEGAL_REVIEW.md` section 6.
