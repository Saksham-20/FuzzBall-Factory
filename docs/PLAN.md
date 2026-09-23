# FuzzBall Factory — Build Plan

Status: **draft, awaiting approval** (2026-09-21). Inputs: `PRODUCT.md`, `docs/research-brief.md`, survey of E-Com / CityFreshKart / HomeKrafted.

---

## 1. Reference project comparison

| | E-Com | CityFreshKart | HomeKrafted |
|---|---|---|---|
| Frontend | CRA (deprecated), JS, Tailwind 3, Context | CRA, JS, Tailwind 3 + Radix + react-hook-form, Context **and** Zustand (duplicated) | **Next.js 16 App Router, React 19, TypeScript**, CSS Modules + tokens |
| Backend | Express + raw `pg` | Express + raw `pg`, hardened (httpOnly cookie JWT, rate limit, request IDs, Docker) | **NestJS + Prisma + Postgres**, guards, DTO validation, tests, CI |
| Payments | Stripe | Razorpay + COD + idempotency | Razorpay + HMAC-verified webhook + idempotency models |
| Uploads | multer → Cloudinary/local | multer → local + sharp | storage driver (GCS/local) + sharp pipeline |
| Messaging | — | Resend email, wa.me button | Resend/SendGrid, Twilio, **WhatsApp Cloud API** in+out |
| Fit | Catalogue schema (variants, reviews, coupons) fits best | Security/ops patterns; per-kg model doesn't fit | Best architecture, but far too big (multi-vendor, wallet, meals, riders) |
| Weak spots | No tests, dead code, fake refresh, hard-coded Tiffany routes | Duplicate components, orphan Prisma, 2k-line admin route file | Heavy, verbose, no Tailwind |

**Recommendation — "HomeKrafted, trimmed":**

- **Frontend:** Next.js 16 (App Router) + TypeScript. Server rendering matters here: WhatsApp/Instagram link previews (OG images) and SEO for product pages. CRA is deprecated, so neither CRA project is a base.
- **Styling:** Tailwind v4 with CSS-variable design tokens (`@theme`), plus `cn()` + Radix primitives + react-hook-form + zod (the CityFreshKart kit, ported to TS).
- **Motion:** Motion (framer-motion) for UI springs; GSAP + ScrollTrigger for scroll-scrubbed yarn/hook scenes; Lenis for smooth scroll; SVG path drawing for the thread. Everything honours `prefers-reduced-motion`.
- **Backend:** NestJS + Prisma + PostgreSQL, a small single-seller API built from HomeKrafted modules (auth, guards, payments, uploads, notifications, whatsapp). Drop vendors, wallet, meals, riders.
- **Auth:** email/phone + password (argon2), JWT access + rotating refresh in httpOnly cookies (CityFreshKart cookie pattern + HomeKrafted refresh rotation), optional Google sign-in later. Roles: `customer`, `admin`.
- **Payments:** Razorpay Orders + Checkout for cart; Razorpay Payment Links for custom-order deposit/balance; verified webhook; COD for ready-to-ship only under a price cap with a COD fee.
- **Images:** Cloudinary (easiest for a solo maker: auto WebP/AVIF, resizing) behind HomeKrafted's storage-driver interface so local disk works in dev.
- **Email:** Resend. **WhatsApp:** Phase 1 wa.me prefilled links everywhere; Phase 2 Cloud API utility templates (HomeKrafted `whatsapp.service.ts`).
- **Deploy:** Vercel (web) + a VPS or Render/Railway (API + Postgres), or one VPS with pm2 + nginx as in HomeKrafted.

### Files to port

- HomeKrafted: `server/src/payments/{razorpay-signature.util,payments.service,razorpay.client}.ts`, `server/src/uploads/storage/*`, `uploads/image-pipeline.ts`, `common/guards/*`, `common/decorators/*`, `auth/{hashing,otp.service}.ts`, `notifications/providers/email.provider.ts`, `whatsapp/whatsapp.service.ts`, trimmed Prisma models, `client/lib/api/http.ts`, `lib/auth/AuthContext.tsx`, `lib/cart/CartContext.tsx`, `lib/payments/razorpay.ts`, `middleware.ts`, CI workflow.
- CityFreshKart: cookie auth helpers + `token_version`, COD flow from `routes/razorpay.js`, `utils/apiErrors.js`, rate limiting, `cn.js`, `WhatsAppFloatingButton`, `AdminLayout` structure, marketing banners.
- E-Com: products / variants / reviews / coupons schema shape, `WishlistContext` logic.

---

## 2. Monorepo layout

```
fuzzball-factory/
  web/            Next.js storefront + account + admin (App Router, TS, Tailwind v4)
  api/            NestJS + Prisma
  packages/shared zod schemas + TS types shared by web and api (statuses, DTOs)
  docs/
```

---

## 3. Design system (to be locked after the direction choice)

Binding from the logo: chocolate brown, dusty rose, cream, kraft. Direction options are on the decision page; the rolled direction is **The Factory Floor** (see §7).

Deliverables in phase 1:

- Tokens: colour (brand + yarn accent swatches + semantic success/warn/error), type scale (display face with personality + clean body sans; no default AI fonts), spacing, radius, shadow, motion (durations, springs, easing).
- Brand assets in repo: logo wordmark, FF monogram, stamp/badge, favicon set, OG template. SVG redraws of yarn ball, crochet hook and thread for animation.
- Component kit: Button, IconButton, Input/Textarea/Select, Swatch picker, Stepper, Badge/Stamp, Ticket card, Product card, Drawer, Modal, Tabs, Toast (sonner), Skeleton, Empty state, Status timeline, File/image uploader, Price, Quantity.
- Motion library: thread draw-on-scroll, hook-stitch reveal, yarn-ball roll-to-cart, heart burst (wishlist), squish hover, stamp-down confirmation, hook loader. Reduced-motion fallbacks for each.
- Skills to apply during build: impeccable (craft floor, finish review), emil-design-eng (interaction polish), ui-ux-pro-max (ecommerce/admin patterns), animate (motion decisions).

---

## 4. Information architecture

### Storefront
| Route | Purpose |
|---|---|
| `/` | Home: scroll story + shop entry + custom entry |
| `/shop`, `/shop/[category]` | Catalogue with filters (category, price, colour, ready-to-ship vs made-to-order, occasion) + sort |
| `/p/[slug]` | Product: gallery/video, variants, lead time, fiber/size/care, "Delivers by" pincode check, add to cart, wishlist, **Customize this**, WhatsApp ask, reviews |
| `/custom` | Custom request form (new idea) |
| `/custom/new?from=[slug]` | Customize an existing product (prefilled) |
| `/cart` (+ drawer) | Cart, gift wrap/note, coupon, free-shipping progress |
| `/checkout` | Address, shipping (India/international), payment (Razorpay / COD if eligible), review |
| `/order/[number]` | Confirmation + public tracking (order no. + phone) |
| `/track` | Track order lookup |
| `/drops` | Limited drops / new arrivals |
| `/about`, `/contact`, `/faq`, `/care-guide`, `/size-guide` | Brand + help |
| `/policies/{shipping,refund,terms,privacy,grievance}` | Razorpay + E-Commerce Rules 2020 |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | Auth |

### Account (`/account`)
Overview · Orders (list + detail with timeline) · **Custom requests** (list + thread: quote, counter, accept/decline, pay deposit/balance, progress photos, approve final) · Wishlist · Addresses · Profile & password · Reviews.

### Admin (`/admin`, role-guarded server-side)
Dashboard (today's orders, pending quotes, revenue, low stock, queue load) · Products (CRUD, images, variants, lead time, stock, one-of-a-kind, publish/draft) · Categories & collections · Orders (list, status updates, AWB/tracking, notes, print slip) · **Custom requests (Kanban by status + thread: quote with price split, timeline, revisions; accept/counter/reject; upload progress photos; send payment link)** · Customers · Reviews moderation · Coupons · Homepage content (banners, drops, marquee) · Settings (shipping rates India/intl, COD cap/fee, lead-time defaults, WhatsApp number, policies text).

---

## 5. Data model (Prisma, first cut)

- **User** id, name, email?, phone?, passwordHash, role, emailVerified, phoneVerified, createdAt
- **RefreshToken**, **Address** (India + international fields: country, state, city, pincode/postal, line1/2, phone)
- **Category** (tree, slug, image), **Collection/Occasion**
- **Product** slug, name, description, basePrice, compareAtPrice, fulfilment (`READY` | `MADE_TO_ORDER`), leadTimeDays, fiber, sizeCm, weightG, packageDims, care, origin, isOneOfAKind, customizable, status (`DRAFT` | `PUBLISHED` | `ARCHIVED`), tags, seo fields
- **ProductImage** (url, alt, order), **ProductVariant** (colour, size, sku, priceDelta, stock), **ColourSwatch**
- **Cart / CartItem** (guest by session id, merged on login), **Wishlist**
- **Order** number, userId?, contact, address snapshot, items snapshot, subtotal, shipping, codFee, giftWrap, discount, total, currency, paymentMethod, paymentStatus, status, estimatedDispatch, courier, awb, trackingUrl, notes
- **OrderEvent** (status history w/ note + photo) — powers the timeline
- **CustomRequest** number, userId, baseProductId?, category, description, colours, size/measurements, quantity, budgetMin/Max, neededBy, occasion, personalization, pincode/country, status, termsAcceptedAt
- **CustomRequestImage**, **CustomMessage** (thread: author, body, attachments)
- **Quote** customRequestId, price, depositPct (50), breakdown, timelineDays, revisions, validUntil, status (`SENT` | `COUNTERED` | `ACCEPTED` | `DECLINED` | `EXPIRED`), counterAmount, counterNote
- **Payment** (razorpay ids, purpose: `ORDER` | `DEPOSIT` | `BALANCE`, amount, status), **WebhookEvent**, **IdempotencyKey**
- **Review** (rating, text, photos, verified, status), **Coupon**, **Banner/Drop**, **Setting** (key/value)

### Custom request state machine
`REQUESTED → UNDER_REVIEW → QUOTED ⇄ COUNTERED (max 2) → ACCEPTED → DEPOSIT_PENDING → IN_QUEUE → IN_PROGRESS → AWAITING_APPROVAL → BALANCE_PENDING → READY_TO_SHIP → SHIPPED → DELIVERED → CLOSED`; exits `DECLINED`, `EXPIRED` (quote > 7 days), `CANCELLED`. Every transition writes an event, sends email, and (phase 2) a WhatsApp template.

### Order state machine
`PENDING_PAYMENT → PLACED → CONFIRMED → IN_PRODUCTION (made-to-order) → PACKED → SHIPPED → DELIVERED`; exits `CANCELLED`, `RETURN_REQUESTED → RETURNED/REFUNDED`. COD orders start at `PLACED` and need WhatsApp confirmation before `CONFIRMED`.

---

## 6. Business rules (from research)

- Lead time shown on card, PDP, cart and checkout; checkout shows estimated dispatch date.
- COD: ready-to-ship only, cap (e.g. ₹2,000, admin-set), COD fee, India only. Never on custom.
- Custom: 50% deposit on accept (non-refundable once work starts), balance before shipping; quote valid 7 days; scope + revisions written in quote.
- Returns: custom/personalized non-returnable unless damaged/wrong; ready-to-ship exchange/refund within a short window with unboxing video.
- One-of-a-kind: qty 1, auto sold-out, 10-min reservation at checkout, "Sold — request similar" → custom form.
- International: prices in INR, approximate local currency shown, admin-set international shipping zones/rates, Razorpay international cards enabled, no COD.
- Colour-variance disclaimer on every PDP; "see it in real light" WhatsApp button.
- Original designs only; custom form states that licensed characters can't be made.
- Legal pages + grievance officer + origin "Made in India".

---

## 7. Visual direction — LOCKED: The Factory Floor (chosen 2026-09-21, seed 9df3606a, code-led build)

**The Factory Floor**: the name taken seriously — a tiny cozy handmade factory where yarn goes in and plushies come out, and the production line *is* the order status.

- One continuous dusty-rose yarn thread unspools from a giant yarn ball in the hero and runs down the page as the "conveyor line" through numbered stations: 01 Yarn Room (colours/fibers), 02 Hook Floor (how it's made, lead times), 03 The Shelf (shop), 04 Work Orders (custom), 05 Shipping Dock (delivery, gifting).
- Product cards are kraft job tickets ("Batch #014 · one of one · ships in 5 days"); custom requests are Work Orders; admin quotes come back as stamped tickets; order tracking is a ticket stamped at each station.
- Thread encodes state by stroke (solid done, dashed in progress, loose end waiting on you); rose reserved for the live thing; everything has an address (Station 03, WO-027); categories are giant cropped words; statuses are named stamps, not colour alone.
- Alternates on the decision page: **The Ball Band** (skein-label world, my own top pick), **Exploded Plushie** (patent-drawing world), and the category standard.

---

## 8. Phases

**Phase 0 — Setup:** monorepo, Next.js + Tailwind v4 + tokens, NestJS + Prisma skeleton, lint/format, env config, logo assets into repo, CI.

**Phase 1 — Design system + UI (mock data, no backend):** tokens, fonts, brand SVGs, component kit, motion library; then pages in this order: Home → Shop → Product → Cart/Checkout (mock pay) → Custom request form → Auth pages → Account (orders, custom thread) → Admin (dashboard, products, orders, custom Kanban/thread, settings) → policies/help. Typed mock API layer (`NEXT_PUBLIC_USE_MOCK`, HomeKrafted pattern) so pages later switch to the real API with no rewrites. Finish with impeccable review (desktop + mobile).

**Phase 2 — Backend:** Prisma schema + migrations + seed, auth (cookies, refresh, roles), catalogue, cart/wishlist, orders, custom requests + quotes + messages, uploads (Cloudinary), admin endpoints, rate limiting, validation.

**Phase 3 — Integrate:** swap mocks for API, server-side admin guard, SSR product pages, OG images, sitemap, JSON-LD.

**Phase 4 — Payments + notifications:** Razorpay checkout + webhook + idempotency, COD rules, deposit/balance payment links, Resend emails for every status change, WhatsApp prefilled links everywhere; Shiprocket serviceability/rates (India) + admin intl rates.

**Phase 5 — Harden + launch:** e2e tests (Playwright) for buy, custom-quote, admin flows; perf on mid-range Android; accessibility pass; deploy; Razorpay website verification checklist.

**Later:** WhatsApp Cloud API templates, Instagram feed, reviews with photos requests, drops countdown, referral codes.

---

## 9. Needed from you (can come later)

- Logo files (PNG/SVG) saved into the repo — the WhatsApp temp paths won't persist.
- Product list: names, categories, prices, photos, lead times, fibers, sizes.
- WhatsApp business number, business email, legal name + address (policies/grievance).
- Razorpay account (test keys to start), Cloudinary account, Resend account, domain.
- International shipping: which countries, flat rates or per-zone.
