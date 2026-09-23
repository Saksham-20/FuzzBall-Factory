# FuzzBall Factory — Implementation Plan (step-by-step, for the build agent)

Read first, in this order: `PRODUCT.md` → `docs/PLAN.md` (decisions, data model, rules) → `docs/research-brief.md` → `.impeccable/surfaces/web-src-app-page-tsx.md` (visual direction contract) → this file.

Work top to bottom. Each task has **Do**, **Files**, and **Done when**. Do not skip "Done when". Commit after each task group (`feat(web): …`, conventional commits).

---

## 0. Ground rules

### 0.1 Stack (confirmed)
- `web/` — Next.js **16.3** App Router, React 19.2, TypeScript, Tailwind **v4** (CSS-first `@theme`, no `tailwind.config`), ESLint.
- `api/` — NestJS + Prisma + PostgreSQL (Phase 2).
- Package manager: npm. Node 20.20.

### 0.2 Next.js 16 gotchas (this is NOT the Next.js in training data)
- Before writing routing/data code, read the matching guide in `web/node_modules/next/dist/docs/01-app/`.
- `middleware.ts` is renamed **`proxy.ts`** (export `proxy`), lives at `web/src/proxy.ts`.
- `params` and `searchParams` are **Promises**: `const { slug } = await props.params`. Same for `cookies()`, `headers()`, and OG image/icon functions. Run `npx next typegen` for `PageProps<'/p/[slug]'>` helpers.
- Turbopack is the default for dev and build.
- `next/image`: default `qualities` is `[75]`; local images with query strings need `images.localPatterns`.

### 0.3 Skills to invoke (Claude Code `Skill` tool)
| When | Skill | Why |
|---|---|---|
| Before any UI file edit | `impeccable` (read `reference/craft-floor.md`) | Quality floor + bans |
| Building components/interactions | `emil-design-eng` | Easing, press states, springs, durations |
| Page layouts, forms, admin tables | `ui-ux-pro-max` | E-commerce + dashboard patterns |
| Each motion piece | `animate` | Motion decision order |
| Toasts | `ask-sonner` | Toaster setup |
| After each phase | `impeccable` `audit` then `polish` | A11y/perf/responsive |
| Finish of Phase 1 | impeccable finish review + documenter → writes `DESIGN.md` | Required by direction contract |
| Before Phase 2 | `plan-eng-review` (optional) | Sanity check API design |

### 0.4 Craft rules that are easy to break (from impeccable craft-floor)
- **No eyebrow/kicker labels above headings.** Station addresses (e.g. "Station 03") live **on the thread node beside the section**, never as a small label above the H2.
- No gradient text. No glassmorphism decoration. No colored `border-left` accents on cards. No hard offset shadows (`4px 4px 0`). No emoji/unicode as icons — use `lucide-react` (stroke 1.75) or authored SVG.
- No same-size icon+heading+text card grids as page structure. No nested cards.
- Card radius 12–16px (`--radius-ticket: 14px`); pills only for small controls.
- Elevation declared once: shadow **or** border, never a 1px border under a wide soft shadow.
- Body text measure 65–75ch. Display max 6rem-ish on desktop (Modak can go larger only for the giant category words, which are intentionally cropped).
- Tracking never below -0.04em.
- Theme browser surfaces: selection, caret, scrollbar, focus ring, underline offset, tabular numerals (already in `globals.css`).
- Every interactive element: hover (gated `@media (hover:hover) and (pointer:fine)`), `:active` scale 0.97, focus-visible, disabled, loading. Every list: empty state. Every fetch: loading skeleton + error state.
- Copy: product's own language. Buttons name the action ("Add to cart", "Send work order", "Accept quote"). Errors say problem + fix.
- **Never invent claims**: no fake review counts, customer numbers, press, "10,000 happy customers". Sample data must be visibly labelled "Sample" in dev (see §2.4).
- Rose (`--rose`) is reserved for the yarn thread and the single active/live state. Do not use it for decoration, badges, or random accents.

### 0.5 Already done (do NOT redo)
- `web/` scaffolded (create-next-app, TS, Tailwind v4, ESLint, `src/`, alias `@/*`).
- Dependencies installed: `motion gsap @gsap/react lenis clsx tailwind-merge class-variance-authority sonner lucide-react react-hook-form zod @hookform/resolvers @radix-ui/react-{dialog,dropdown-menu,tabs,accordion,select,popover,checkbox,radio-group,slot}`.
- `web/src/app/globals.css` — full token set (colours, easing, shadows, utilities `.kraft`, `.perf-top`, `.press`, `.tabular`, `.font-display`, `.font-stencil`, marquee keyframes, reduced-motion). Keep and extend; do not replace.
- `web/src/lib/types.ts` — all domain types (Product, Order, CustomRequest, Quote, etc.). Extend rather than duplicate.
- `web/public/samples/*` — 19 openly-licensed placeholder crochet photos + `PROVENANCE.md`. These are NOT the maker's products.
- `PRODUCT.md`, `docs/PLAN.md`, `docs/research-brief.md`, `.impeccable/surfaces/web-src-app-page-tsx.md`.
- Still to delete: the default `web/src/app/page.tsx` content and `web/public/*.svg` Next demo icons (Task 1.1).

---

## 1. Phase 0 — Finish setup

### Task 1.1 — Clean scaffold + fonts + root layout
**Do**
- Delete demo SVGs in `web/public/` (file.svg, globe.svg, next.svg, vercel.svg, window.svg). Remove `web/.git` if present (repo root is the git repo).
- `web/src/app/fonts.ts`:
  ```ts
  import { Modak, Figtree, Big_Shoulders_Stencil } from "next/font/google";
  export const modak = Modak({ weight: "400", subsets: ["latin"], variable: "--font-modak", display: "swap" });
  export const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });
  export const stencil = Big_Shoulders_Stencil({ subsets: ["latin"], variable: "--font-stencil", display: "swap", weight: ["600","800"] });
  ```
  (If the export name differs, check `node_modules/next/dist/compiled/@next/font/dist/google/index.d.ts`.)
- Root `layout.tsx`: `<html lang="en-IN" className={modak.variable + figtree.variable + stencil.variable}>`; default metadata (title template `%s · FuzzBall Factory`, description "Handmade crochet plushies, bouquets, bags and gifts — ready to ship or made to order. Handmade with love in India."), `metadataBase` from `NEXT_PUBLIC_SITE_URL`, themeColor `#f6eee3`. Mount `<Toaster />` from sonner (position bottom-center, styled with tokens: cocoa bg, cream text, 14px radius).
- `.env.example`: `NEXT_PUBLIC_SITE_URL=http://localhost:3000`, `NEXT_PUBLIC_USE_MOCK=true`, `NEXT_PUBLIC_API_URL=http://localhost:4000`, `NEXT_PUBLIC_WHATSAPP=91XXXXXXXXXX`, `NEXT_PUBLIC_RAZORPAY_KEY_ID=`.
- `next.config.ts`: `images.remotePatterns` for `res.cloudinary.com` (later), `images.formats: ['image/avif','image/webp']`.
- Add scripts: `"typecheck": "tsc --noEmit"`, `"format": "prettier --write ."` (install prettier + prettier-plugin-tailwindcss as devDeps).

**Done when:** `npm run dev` shows a blank cream page with the right fonts loaded; `npm run build` and `npm run lint` and `npm run typecheck` pass.

### Task 1.2 — Utilities
**Files** `web/src/lib/`
- `cn.ts` — `clsx` + `tailwind-merge`.
- `format.ts` — `formatINR(n)` via `Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0})`; `approxLocal(inr, currency)` using a static rate table (USD, GBP, EUR, AED, CAD, AUD, SGD) labelled "approx."; `formatDate`, `addBusinessDays(date, n)`, `dispatchDate(leadTimeDays)`; `batchLabel(n) → "Batch #014"`; `orderNo` / `woNo` helpers (`FB-1023`, `WO-027`).
- `whatsapp.ts` — `waLink(text)` → `https://wa.me/${NEXT_PUBLIC_WHATSAPP}?text=${encodeURIComponent(text)}`; builders: `waProduct(product, url)`, `waOrder(orderNo)`, `waCustom(woNo)`, `waCart(lines)`, `waRealLight(product)` ("Can I see {name} in {colour} in natural light?").
- `constants.ts` — nav links, stations list (id, number, name, anchor), status → label/stamp-shape maps for `OrderStatus` and `CustomStatus`, COD rules, countries list with ISO codes and intl zone mapping.

**Done when:** unit-testable pure functions; add `vitest` and a `format.test.ts` + `whatsapp.test.ts` covering INR formatting, business-day math, URL encoding.

---

## 2. Phase 1 — Design system + UI on mock data

### 2.1 Visual system spec (implement exactly)

**Colour roles** (tokens exist in `globals.css`)
| Token | Hex | Use |
|---|---|---|
| `cream` | #f6eee3 | page ground |
| `paper` | #fcf8f2 | raised surfaces, inputs, tickets' inner panel |
| `cocoa` | #3f2619 | primary text, primary button bg |
| `brown` | #6b4228 | logo brown, secondary text on cream (passes AA on cream) |
| `brown-soft` | #8a6249 | tertiary text (≥ 18px only, check contrast) |
| `kraft` / `kraft-light` / `kraft-deep` | #d4ae80 / #e8d3b4 / #a8804f | job tickets, tags, section fields |
| `butter` / `butter-deep` | #f4cd52 / #d9ab1f | tape strip, one loud accent per viewport, selection |
| `rose` / `rose-deep` / `rose-wash` | #c98586 / #9c4f55 / #f3dcd8 | yarn thread, active state, focus ring (rose-deep), live badges |
| `ok` `warn` `err` (+ `-wash`) | | form/status semantics |

Colour strategy: **Full palette, committed at page scale** — whole sections own a field (a kraft field for the Work Orders station, a cocoa field for the Shipping Dock/footer, butter tape strips). Not scattered accents.

**Type**
| Role | Face | Size (mobile → desktop, use `clamp`) | Notes |
|---|---|---|---|
| Hero display | Modak | 3.5rem → 7.5rem, line-height 0.9 | cocoa; one word may be rose only if it is the "live" word |
| Giant category words | Modak | 22vw → 16vw, cropped off edge | cocoa on kraft / cream on cocoa |
| Section H2 | Modak | 2.5rem → 4.5rem | |
| H3 / product names | Figtree 700 | 1.125rem → 1.375rem | tracking -0.02em |
| Body | Figtree 400/500 | 1rem → 1.0625rem, line-height 1.6 | max 68ch |
| UI / labels | Figtree 600 | 0.875rem | |
| Addresses, stamps, batch/order numbers | Big Shoulders Stencil 800 | 0.8125rem → 1rem, uppercase, tracking 0.06em | `.font-stencil .tabular` |
| Prices | Figtree 700 tabular | | |

**Spacing**: 4px base. Section vertical padding `clamp(4rem, 10vw, 9rem)`. More space above headings than below (e.g. `mt-16 mb-6`). Content max-width 1280px, gutters 16px mobile / 32px tablet / 48px desktop.

**Radius**: tickets/cards 14px; inputs 12px; buttons 999px (pills allowed for small controls) or 12px for large primary CTAs — pick 999px for all buttons for consistency.

**Shadow**: `shadow-ticket` resting, `shadow-lift` on hover/drag. No borders on shadowed elements.

**Motion tokens** (Emil): `--ease-out cubic-bezier(0.23,1,0.32,1)` for enters; `--ease-in-out` for on-screen movement; `--ease-drawer` for drawers/sheets. Durations: press 140ms, hover 180ms, dropdown 200ms, drawer 380ms, toast default. Springs (Motion): `{ type: "spring", duration: 0.5, bounce: 0.2 }` for playful items (add-to-cart, wishlist), bounce 0 for layout. Never animate from `scale(0)` (start 0.9–0.95 + opacity 0). Hover animations gated to fine pointers. Keyboard-triggered actions: no animation.

### 2.2 Brand primitives (authored SVG — geometry, not illustration)
**Files** `web/src/components/brand/`

| Component | Spec |
|---|---|
| `LogoMark.tsx` | **Placeholder until real logo arrives.** Wordmark: "FuzzBall" in Modak, "Factory" in Figtree 600 tracked 0.4em, plus a small rose thread-heart path. Props `variant: "full" \| "mono" \| "stamp"`, `className`. Put `// TODO: replace with supplied logo SVG` and keep the API stable so the swap is a one-file change. Also export `FFMonogram` (two F's + circle) for favicon/app icon placeholder. |
| `YarnBall.tsx` | Circle + 6–8 curved "wrap" paths (crisp strokes, not sketchy), fill from prop `colour` (default rose), strokes a darker mix. Optional `spin` prop rotating wraps slowly (CSS, disabled on reduced motion). Exposes the loose-end point via `ref` / props so the Thread can start from it. |
| `CrochetHook.tsx` | Long rounded shaft + hooked head + flat thumb rest; brown/kraft fills. `rotate` prop. |
| `Thread.tsx` | The signature element. An SVG path with props `d`, `state: "done" \| "active" \| "waiting"`. done = solid rose 3px; active = rose dashed (`stroke-dasharray: 10 8`, marching via `stroke-dashoffset` animation, linear, 1.2s); waiting = solid up to the end then a loose curl end + small knot circle. Used by the home page conveyor and by every status timeline. |
| `Stamp.tsx` | Rubber-stamp status badge. Props `status`, `shape: "circle" \| "rect" \| "star" \| "ticket"`. Stencil text, 2px inked border, slight rotation (-4°..4° deterministic from status), ink colour by status family (cocoa default, ok, warn, err, rose for the current/live stamp). Shape differs per status family so colour is never the only signal. |
| `Ticket.tsx` | Kraft job-ticket container: `.kraft` background, 14px radius, punched hole (circle cut-out via mask) top-left, perforated divider (`.perf-top` on inner stub), stencil header row slot (`Batch #014 · one of one`). Variants: `product`, `order`, `work-order`, `quote`. |
| `Tape.tsx` | Butter marquee strip: repeated items ("Handmade in India", "Made to order", "UPI · Cards · COD", "Ships worldwide", "Custom work orders open") separated by a small yarn-ball glyph (SVG). Uses `.tape-track`, duplicated content for seamless loop, slight -1.5° rotation, pauses on hover and stops on reduced motion. |
| `StationNode.tsx` | Numbered circle on the thread (stencil "03") + station name next to it; used as section anchor markers on home. |

**Done when:** a dev-only route `/dev/kit` renders every primitive and variant (delete or `notFound()` in production via `process.env.NODE_ENV`).

### 2.3 UI kit
**Files** `web/src/components/ui/` — built on Radix where noted, styled with tokens, `cva` variants, `forwardRef`, full states.

| Component | Notes |
|---|---|
| `Button` | variants `primary` (cocoa bg, cream text), `secondary` (paper bg, cocoa text, shadow-ticket), `ghost`, `tape` (butter), `danger`; sizes sm/md/lg; `loading` (hook-spinner + keeps width); `asChild` via Radix Slot; `.press`. |
| `IconButton` | 44px min hit area, `aria-label` required by type. |
| `Input`, `Textarea`, `Select` (Radix), `Checkbox`, `RadioGroup` | Label above, hint below, error text in `err` with icon; paper bg, 12px radius, 1.5px `line-strong` border (inputs use border, not shadow); focus ring rose-deep. |
| `Field` | label + control + hint + error wiring for react-hook-form (`aria-describedby`, `aria-invalid`). |
| `SwatchPicker` | Radio group of colour dots (32px) with name tooltip, selected ring in cocoa + check; supports "sold out" slash. |
| `QuantityStepper` | − / value / +, min/max, tabular. |
| `Price` | current + compare-at (struck) + optional "approx. $12" line for intl. |
| `Badge` | small pill: `ready` ("Ready to ship" ok-wash), `mto` ("Made to order · 5 days" warn-wash), `ooak` ("One of one" butter), `sample` ("Sample" dashed border — dev data marker). |
| `Drawer` | Radix Dialog as a right sheet (desktop) / bottom sheet (mobile), `--ease-drawer` 380ms enter, 240ms exit; swipe-to-close on mobile with velocity check (>0.11 px/ms). |
| `Modal` | Radix Dialog centered; use only when focus must be protected (confirmations). |
| `Tabs`, `Accordion`, `DropdownMenu`, `Popover` | Radix, token styled, origin-aware (`transform-origin: var(--radix-popover-content-transform-origin)`). |
| `Skeleton` | kraft-light shimmer (reduced motion: static). |
| `EmptyState` | small YarnBall + title + one line + action. |
| `Timeline` | vertical `Thread` with `StationNode`s; each event: stamp, time, note, optional photo thumbnail. Past events done, current active, future dimmed; if waiting on customer → loose end + CTA. Used by order detail, tracking, work orders (customer + admin). |
| `ImageUploader` | drag/drop + click, up to N images, previews with remove, size/type validation (jpg/png/webp/heic ≤ 8MB), mock upload returns object URLs. |
| `Toaster` usage | `toast.success("Added to cart")` etc. via sonner. |
| `HookSpinner` | CrochetHook rotating ±20° + small loop; used in Button loading and page loaders. |

**Done when:** all kit components are on `/dev/kit` with every state (default/hover/focus/disabled/loading/error/empty), keyboard-operable, and axe has no violations (install `@axe-core/react` in dev or run the Playwright axe check in Phase 5).

### 2.4 Mock data + API layer
Pattern from HomeKrafted `client/lib/api/*`: every page calls `lib/api/<domain>.ts`; each function checks `process.env.NEXT_PUBLIC_USE_MOCK === "true"` and either returns mock data (with a 250–600ms artificial delay) or calls `http.ts` against `NEXT_PUBLIC_API_URL`. **Signatures must match the Phase 2 API exactly (see §3.4)** so the swap is config-only.

**Files**
- `lib/api/http.ts` — typed `fetch` wrapper: base URL, `credentials: "include"`, JSON, `ApiError { status, code, message, fields? }`, 401 → one refresh attempt (`POST /auth/refresh`) then redirect to `/login?next=`; de-dupe concurrent refreshes (port idea from HomeKrafted `lib/api/http.ts`).
- `lib/api/{catalog,cart,orders,custom,auth,account,admin,settings,reviews,shipping}.ts`.
- `lib/mock/*.ts` — seed data (below) + an in-memory store persisted to `localStorage` under `fbf-mock-v1` so admin changes (e.g. sending a quote) show up in the user account in the same browser. Provide `resetMock()` on `/dev/kit`.

**Seed data** — all products flagged `sample: true` and rendered with the `Sample` badge while `USE_MOCK` is on.

Categories (slug · name · giant word · image):
`bouquets` Bouquets & Flowers "bouquets" flowers.jpg · `keychains` Keychains & Charms "charms" keychain.jpg · `plushies` Plushies "squishy" bear.jpg · `wearables` Wearables "wearables" top.jpg · `hair` Hair Accessories "hair" hairpins.jpg · `home` Home & Desk "cozy" coasters.jpg · `baby` Baby "tiny" chick.jpg · `gifting` Gift Sets "gifts" flowers.jpg.

Products (batch · slug · name · category · price ₹ · fulfilment/lead · image):
1 · rosie-bear · Rosie the Bear · plushies · 1,450 · MTO 7d · bear.jpg
2 · pocket-penguins · Pocket Penguin Keychain · keychains · 399 · READY · penguin.jpg
3 · wildflower-bouquet · Wildflower Forever Bouquet · bouquets · 1,299 · MTO 5d · flowers.jpg
4 · blossom-clips · Blossom Hair Clips (set of 3) · hair · 349 · READY · hairpins.jpg
5 · tiny-cactus · Tiny Cactus Pot · home · 549 · READY · cactus.jpg
6 · cube-kitties · Cube Kitty · plushies · 699 · MTO 4d · kitty.jpg (variants: pink, mint, peach)
7 · butter-chick · Butter Chick & Egg · baby · 649 · MTO 4d · chick.jpg
8 · midnight-beanie · Midnight Stripe Beanie · wearables · 1,199 · MTO 6d · hat.jpg (sizes S/M/L)
9 · sunny-halter · Sunny Halter Top · wearables · 1,899 · MTO 10d · top.jpg (sizes XS–L + custom measurements)
10 · mandala-charm · Mandala Bag Charm · keychains · 299 · READY · keychain.jpg
11 · granny-charm · Granny Square Charm · keychains · 279 · READY · charm.jpg
12 · micro-mice · Micro Mice Keychain (pair) · keychains · 449 · READY one-of-a-kind (stock 1) · mice.png
13 · coaster-box · Coaster Set in a Box (4) · home · 799 · READY · coasters.jpg
14 · witchy-kitty · Witchy Kitty · plushies · 1,099 · READY one-of-a-kind, **sold out** · cat.jpg
15 · mug-rug · Mug Rug · home · 249 · READY · baby-toy.jpg
Each product: tagline (≤ 8 words), 60–100 word description, fiber (e.g. "Milk cotton, 4-ply"), sizeCm ("14 cm tall"), weightG, care list, 2–3 images (reuse stitch close-up `flower-single.jpg` and `yarn-assorted.jpg` as secondary shots), swatches, variants with stock, occasions, `customizable: true` except sold-out OOAK, `rating` **omitted** (no invented reviews).

Other seed: 2 users (`maya@example.com` customer, `admin@fuzzball.test` admin — mock login accepts password `fuzzball123`), 2 addresses (one India, one UK), 5 orders across statuses (PLACED COD awaiting confirm, IN_PRODUCTION, SHIPPED with AWB, DELIVERED, CANCELLED), 6 custom requests one per key status (REQUESTED, QUOTED with a live quote, COUNTERED, DEPOSIT_PENDING, IN_PROGRESS with 2 progress photos, DECLINED) with message threads, 3 coupons (`FIRSTFUZZ` 10%, `GIFT100` ₹100 off ≥ ₹999, `EXPIRED20` inactive), settings (`freeShippingAbove 999`, `domesticShipping 79`, `codEnabled true`, `codCap 2000`, `codFee 49`, `giftWrapPrice 59`, `depositPct 50`, `quoteValidityDays 7`, intl zones: South Asia & Middle East ₹899 7–12 days; UK/Europe ₹1,499 8–14 days; USA/Canada/Australia ₹1,799 10–16 days; Rest of world ₹1,999 12–20 days). Reviews: none seeded (reviews UI must render an honest empty state: "No reviews yet — be the first after your order arrives").

### 2.5 Client state
**Files** `web/src/lib/state/`
- `CartContext.tsx` — lines in localStorage (`fbf-cart-v1`); `add/update/remove/clear`; derived `subtotal`, `count`, `hasMadeToOrder`, `maxLeadTime`, `codEligible` (all READY, total ≤ codCap, country IN), `freeShippingRemaining`; one-of-a-kind items max qty 1. Cart drawer open state lives here.
- `WishlistContext.tsx` — guest localStorage `fbf-wish-v1`; on login merge into account (mock).
- `AuthContext.tsx` — `user`, `login`, `signup`, `logout`, `refresh`; mock uses localStorage session; real uses cookies + `GET /auth/me`.
- `CurrencyContext.tsx` — display currency (INR default; auto-guess from `navigator.language`, user switch in footer); INR is always the charged currency; others show "approx.".
- Wrap in `app/providers.tsx` (client component).

### 2.6 Storefront shell
**Files** `web/src/app/(store)/layout.tsx`, `components/store/{Header,Footer,CartDrawer,WhatsAppButton,SearchDialog,MobileNav}.tsx`
- **Header**: sticky, cream at 92% + backdrop blur 8px only after scroll > 8px (functional, not decorative), height 64/72px. Left: LogoMark. Center (desktop): Shop (mega dropdown of categories with giant-word previews), Custom work order, Drops, Track order. Right: search, wishlist (count), account, cart (count bubble in cocoa; bumps with a spring when count changes). Mobile: logo + cart + menu; menu is a full-height sheet with big Modak links.
- **Tape** strip below header on home only.
- **CartDrawer**: lines (image, name, colour/size, qty stepper, price, remove), per-line MTO/ready badge, **free-shipping progress drawn as a rose Thread filling to a knot**, gift wrap toggle + note, subtotal, "Checkout", "Send cart on WhatsApp" link. Empty state: YarnBall + "Your basket's empty" + "Shop the shelf".
- **WhatsAppButton**: bottom-right 56px, cocoa bg with WhatsApp glyph (use a proper SVG), tooltip bubble "Questions? Chat with the maker" appears once after 8s per session; sits above mobile sticky add-to-cart on PDP (use a CSS var `--sticky-offset`); hidden on `/checkout` and `/admin`.
- **Footer** (cocoa field, cream text): big "Handmade with love" in Modak, columns Shop / Help (Track order, Shipping, Returns, Size guide, Care guide, FAQ) / Company (About, Contact, Custom orders) / Legal (Terms, Privacy, Refund, Shipping, Grievance). Currency switcher, payment methods row (text list, no fake logos), "Made in India" line, © year. Newsletter input optional (mock).

### 2.7 Home page `/` — the signature surface
Implement exactly per the direction contract. Use GSAP + ScrollTrigger (register in a client component with `useGSAP` from `@gsap/react`) for the scroll-scrubbed thread; Lenis for smooth scroll (disable on reduced motion and on touch if jank). Keep all content visible by default — animations enhance, never hide content if JS fails.

Sections in order:
1. **Hero (first viewport)** — grid 55/45 desktop, stacked on mobile (yarn ball above headline, smaller).
   - Left: H1 Modak "Yarn in. Fuzzballs out." (2 lines). Sub: "Plushies, bouquets, bags and wearables crocheted by hand in India. Ready to ship, or made to order just for you." Primary Button "Shop the shelf" → `/shop`; secondary "Start a work order" → `/custom`. Under buttons a stencil line: "Ships across India & worldwide · UPI, cards, COD".
   - Right: big `YarnBall` (rose) with loose end → `Thread` path curving left under the headline and exiting the bottom of the viewport; `CrochetHook` hooked on the thread; a small `Ticket` pinned to the ball ("Batch #001 · one of one").
   - Entrance (once, ≤ 900ms total): ball scales 0.92→1 with spring, thread draws from the ball (stroke-dashoffset, ease-out 700ms), hook rotates in 12°→0°, headline words rise 12px + fade with 60ms stagger. Reduced motion: no entrance, everything static.
   - Tape strip anchored at the bottom edge of the viewport.
2. **The conveyor** — one continuous rose `Thread` SVG positioned absolutely down the page (left gutter on desktop, far-left 16px on mobile) connecting 5 `StationNode`s. ScrollTrigger scrubs `stroke-dashoffset` so the thread is drawn as you scroll; the `CrochetHook` rides the drawing tip (GSAP `motionPath` plugin — free now, import from `gsap/MotionPathPlugin`). Each station: thread segment before it = done (solid), current = active (dashed marching). On mobile, simplify to a straight vertical thread with nodes.
3. **Station 01 · Yarn Room** — H2 "Every piece starts as a ball of yarn". Horizontal row of 6 real yarn swatches (fiber cards on paper: name, fiber, feel — e.g. "Milk cotton · soft, matte, baby-safe"). Photo `yarn-assorted.jpg` cropped in a ticket frame. Copy about fibers + colour variance honesty line.
4. **Station 02 · Hook Floor** — H2 "Made by one pair of hands". Split: left the maker's process in 3 steps as a stitch-row (not cards): Pick your yarn → Hooked row by row → Stuffed, finished, packed. Right: stitch close-up (`flower-single.jpg`). A live-looking but honest "lead time" explainer: "Ready-to-ship pieces leave in 1–2 days. Made-to-order pieces take 4–10 days — we show the exact time on every product." No fake queue numbers.
5. **Station 03 · The Shelf** — H2 "The shelf". **Category doors**: giant cropped Modak words (`squishy`, `bouquets`, `charms`, `wearables`, `cozy`, `tiny`, `gifts`) in a vertical stack, each a full-width link, cropped off the right edge; on hover (fine pointer) the word slides left 4% and a product cut-out image peeks in; on touch, a small image sits inline. Below: "Fresh off the line" — 8 ProductTickets in a horizontal scroll-snap rail (mobile) / 4-col grid (desktop) + "See all" link.
6. **Station 04 · Work Orders** — full **kraft field** section. H2 "Got an idea? Put in a work order." Left: 4-step flow as a stamped ticket stub: Describe it → Get a quote → Pay 50% to start → Watch it get made. Right: an example **Work Order ticket** (clearly marked "Example") showing WO-027, request text, quote ₹1,850, stamps. Two CTAs: "Start a work order" and "Customize something from the shelf". Note: "We can't make licensed characters (Disney, Sanrio, anime) — original designs only."
7. **Station 05 · Shipping Dock** — H2 "Packed with care, shipped anywhere". Three facts in a single row divided by thin rules (not cards): India shipping ₹79, free above ₹999; International from ₹899 (zones link); Gift wrap + note ₹59. Track order inline form (order no. + phone) → `/track`.
8. **Maker's note** — short first-person note placeholder ("Hi, I'm [maker name]…") marked TODO for the user; WhatsApp CTA "Say hi on WhatsApp".
9. **Instagram strip** — placeholder rail of 6 squares linking to Instagram profile (TODO handle). No fake follower counts.
10. Footer.

**Done when:** desktop 1440 and mobile 390 screenshots show the full story; Lighthouse mobile performance ≥ 85 with sample images (use `next/image` with `sizes`), CLS < 0.05; reduced motion renders a clean static page; no content hidden without JS.

### 2.8 Shop `/shop` and `/shop/[category]`
- Header row: H1 (category name or "The shelf"), result count, sort (Newest, Price low–high, Price high–low, Ready to ship first).
- Filters: desktop left rail, mobile bottom sheet: Category, Price range (slider or preset chips: < ₹500, ₹500–1,000, ₹1,000–2,000, ₹2,000+), Availability (Ready to ship / Made to order), Colour (swatches), Occasion (Birthday, Anniversary, Valentine's, Baby shower, Rakhi, Just because). Filters sync to URL `searchParams` (await them — Next 16).
- Grid: 2 cols mobile, 3 tablet, 4 desktop of `ProductTicket`.
- **ProductTicket** (`components/store/ProductTicket.tsx`): Ticket variant product; image 4:5 with rounded inner corners; stencil header "Batch #003 · One of one" (or "Batch #003"); name; price; badge (Ready / MTO · n days / One of one / Sold out); wishlist heart (IconButton top-right on image; heart burst spring on add — 6 small rose dots radiating 18px, 400ms, not on reduced motion); quick add (+) for single-variant READY items; hover (fine pointer) tilt 1.5° + shadow-lift + second image crossfade with 2px blur bridge. Sold out: image desaturated, stamp "SOLD", CTA "Request a similar one" → `/custom?from=slug`.
- Empty filter result: EmptyState "Nothing on this shelf with those filters" + "Clear filters" + "Put in a work order instead".
- Loading: 8 skeleton tickets. Pagination: "Load more" button (12 per page).
- SEO: `generateMetadata` per category.

### 2.9 Product page `/p/[slug]`
Layout: desktop 2 columns (gallery 7/12, info 5/12 sticky); mobile stacked with **sticky bottom add-to-cart bar**.
- **Gallery**: main image 4:5, thumbnails row, swipe on mobile (scroll-snap), zoom on click (Modal lightbox with pinch). Last slide optional video.
- **Info column**:
  - Stencil "Batch #001" + badges; H1 name (Figtree 800, 2rem); tagline; Price (+ approx. local currency when non-INR selected).
  - Swatch picker (colour), size select if any (+ "Size guide" link opens Drawer with a cm table and how-to-measure), personalization input when enabled (char counter, max 20).
  - **Lead time block** (a mini Thread with 3 nodes): "Ordered today → Made by {date} → Delivered ~{date}" computed from lead time + transit estimate (India 3–6 days; intl zone days). For READY: "Leaves the factory in 1–2 days".
  - Pincode/country check: input 6-digit pincode → mock serviceability returns "Delivers by {date} · COD available/not available". Country select for intl.
  - Qty stepper (max 1 for one-of-a-kind), "Add to cart" (primary; on add: yarn ball SVG flies along a curved path to the header cart icon — Motion `animate` on a portal element, 550ms ease-in-out, cart count bumps; reduced motion: just toast), "Buy now", wishlist.
  - Secondary actions row: "Customize this" → `/custom?from=slug`, "Ask on WhatsApp" (waProduct), "See it in real light" (waRealLight).
  - Accordion: Details (fiber, size in cm, weight, origin "Made in India"), Care, Shipping & returns (MTO/custom non-returnable note), Colour note ("Colours may vary slightly between screens and yarn batches").
- **Below**: "Made to be customized" kraft band with CTA; Reviews section (honest empty state, form only for verified buyers — mock); "More from the shelf" rail (same category).
- JSON-LD `Product` + `Offer` (no `AggregateRating` until real reviews exist). `generateMetadata` + dynamic OG image (`opengraph-image.tsx`: cream bg, product image, name, price, logo placeholder) — matters for WhatsApp shares.
- Sold out one-of-a-kind: replace buy area with stamp SOLD + "Request a similar one".
- Not found → custom `not-found.tsx` ("This batch doesn't exist" + shop link).

### 2.10 Custom work order `/custom`
- If `?from=slug`: kind CUSTOMIZE, show base product mini-ticket at top ("Customizing: Rosie the Bear") and prefill category/colours.
- Form on a large **Work Order ticket** (paper panel inside kraft ticket, stencil header "WORK ORDER · WO-NEW"). Multi-step with a Thread stepper (4 steps, can go back; progress persisted to localStorage so refresh doesn't lose it):
  1. **The idea**: category (select), title (≤ 60), description (textarea ≥ 30 chars, hint "Size, colours, who it's for, anything we should know"), reference images (ImageUploader up to 5).
  2. **The details**: colours (SwatchPicker multi + free text), size (free text + cm), quantity (1–50; > 10 shows "bulk/corporate" note), personalization text, occasion, needed-by date (min = today + 7 days; shows warning if < lead time estimate).
  3. **Budget & delivery**: budget range (two inputs ₹ min/max with preset chips: under ₹1,000 / ₹1,000–2,500 / ₹2,500–5,000 / ₹5,000+), country + pincode/postal code, gift wrap toggle.
  4. **Review & send**: summary ticket; contact (prefilled if logged in; else name, email, WhatsApp number with country code) — **requires login to submit**: if guest, "Send work order" opens login/signup in a Drawer and returns to submit (form state preserved); terms checkbox: "I understand: 50% advance to start, custom pieces can't be returned, colours may vary slightly, no licensed characters."
- zod schema in `lib/schemas/custom.ts` (shared later with api via `packages/shared`).
- Success page `/custom/sent/[wo]`: big stamp "RECEIVED", WO number, what happens next (reply within 24–48h — make this a setting, not a claim), links "View in your account", "Chat on WhatsApp" (waCustom).

### 2.11 Cart `/cart` and Checkout `/checkout`
- `/cart`: full-page version of drawer + coupon input (validates against mock coupons, shows error "This code has expired" etc.) + estimated dispatch date (max lead time) + totals breakdown.
- `/checkout` (requires login or guest checkout with email+phone — support **guest checkout**, offer account creation after):
  1. Contact (email, phone with country code).
  2. Address (saved addresses picker for logged-in; country select drives fields: India → pincode 6 digits + state select; other → postal code + region free text). Pincode check updates delivery estimate.
  3. Delivery: India standard (₹79 or free ≥ ₹999) / international zone rate by country (read-only, shows days).
  4. Gift: wrap toggle, note (≤ 200), "Hide prices on packing slip".
  5. Payment: **Razorpay** (UPI, cards, netbanking, wallets) default; **COD** radio shown only when `codEligible` — otherwise disabled with reason ("COD isn't available for made-to-order items" / "…for orders above ₹2,000" / "…outside India"). COD adds ₹49 fee line and a note "We'll confirm on WhatsApp before dispatch".
  6. Review: items with MTO badges, "Estimated dispatch {date}", policy checkbox (links to refund + shipping policy), total breakdown (subtotal, shipping, gift wrap, COD fee, discount, total — required by E-Commerce Rules).
- Mock payment: button "Pay ₹X" opens a fake Razorpay modal (clearly labelled "Test payment") with Success / Fail buttons; success → `/order/[number]?new=1`; fail → inline error with retry.
- Order confirmation `/order/[number]`: stamp animation "PLACED" (stamp-down: scale 1.15→1 + rotate settle, 260ms, one-time), order summary, Timeline, WhatsApp "Share order" link, create-account prompt for guests.

### 2.12 Track `/track`
- Form: order number + phone (or email). Result shows Timeline with stations: Placed → Confirmed → In production (MTO only) → Packed → Shipped (courier + AWB + tracking link) → Delivered. Errors: "We couldn't find that order — check the number on your confirmation email".

### 2.13 Auth `(auth)` group
Routes `/login`, `/signup`, `/forgot-password`, `/reset-password`. Split layout: left form on paper, right a kraft panel with a slow-spinning YarnBall + tape (hidden on mobile).
- Login: email or phone + password, "Show password", remember me, errors inline, `?next=` redirect. Link to signup/forgot.
- Signup: name, email, phone (optional, country code), password (≥ 8, strength hint), accept terms; after signup → `/account` with welcome toast.
- Forgot: email → "If that email has an account, we've sent a reset link" (no account enumeration).
- Reset: token from query, new password ×2.
- Admin logs in through the same form; role decides redirect (`/admin`).
- All forms: react-hook-form + zod, disabled submit while pending, button loading state.

### 2.14 Account `/account` (layout with side nav desktop, top tabs mobile)
- **Overview**: greeting, latest order mini-timeline, open work orders needing action (e.g. "Quote waiting — expires in 3 days"), quick links.
- **Orders** list (ticket rows: number stencil, date, items thumbs, total, Stamp) → **Order detail** `/account/orders/[number]`: items, totals, address, Timeline, invoice download (mock PDF link TODO), "Need help?" WhatsApp, cancel button while PLACED/CONFIRMED (Modal confirm), return request for READY items within 7 days of delivery (form with reason + unboxing video upload).
- **Work orders** list → **detail** `/account/custom/[wo]`: the core negotiation screen.
  - Top: WO ticket (title, status Stamp, created, needed-by).
  - Left: request details + reference images.
  - Right: **Quote card** when QUOTED: price, breakdown lines, deposit (50%) and balance amounts, timeline days, revisions, scope text, "Valid until {date}" countdown; actions: **Accept & pay deposit** (mock Razorpay), **Counter** (Drawer: amount + note; disabled after 2 counters with explanation), **Decline** (Modal confirm + optional reason).
  - Status-specific panels: DEPOSIT_PENDING → pay deposit; IN_PROGRESS → progress photos gallery; AWAITING_APPROVAL → "Approve final piece" / "Request a change" (counts against revisions); BALANCE_PENDING → pay balance; SHIPPED → tracking.
  - Thread: message list (maker vs customer bubbles, attachments), composer with image attach. Link "Continue on WhatsApp".
  - Timeline of the request.
- **Wishlist**: grid of tickets, move to cart, remove; empty state.
- **Addresses**: list, add/edit (Drawer form), set default, delete (confirm).
- **Profile**: name, email, phone, change password, delete account request (DPDP — "We'll delete your data within 30 days").

### 2.15 Admin `/admin` (Operate mode — brand lives in details, density and speed first)
Layout: left sidebar (collapsible; bottom tab bar on mobile with 5 key items + "More"), top bar with search and "View store". Use same tokens; tables on paper, stencil for IDs, Stamps for statuses. Admin must be fully usable on a phone.
- **Dashboard**: today's numbers (orders today, revenue today/7d/30d, pending COD confirmations, quotes awaiting response, work orders in progress, low-stock items) — real counts from mock store, no fabricated trends; "Needs you" list (COD to confirm, requests to quote, counters to answer, quotes expiring in 48h, orders to pack); simple revenue bar chart (use `dataviz` skill guidance; plain SVG bars, 30 days).
- **Products**: table (image, name, batch, category, price, stock, fulfilment, status) with search, filters, bulk publish/archive; **Product editor** `/admin/products/[id]` (and `/new`): basics, images (uploader with reorder via drag), pricing (price, compare-at), fulfilment + lead time, one-of-a-kind toggle, variants table (colour, size, price delta, stock), fiber/size/weight/package dims, care list, occasions/tags, customizable toggle, SEO fields, status. Autosave draft indicator; unsaved-changes guard.
- **Categories**: list + edit (name, slug, giant word, image, order).
- **Orders**: table with status tabs (All, To confirm (COD), To make, To pack, Shipped, Delivered, Cancelled/Returns); order detail: items, customer, address, payment, **status actions** (Confirm COD after WhatsApp, Start production, Mark packed, Add courier + AWB → Shipped, Mark delivered, Cancel/refund with reason), notes, timeline, print packing slip (print CSS, hides prices if gift), WhatsApp customer (prefilled per status).
- **Work orders** `/admin/custom`: **Kanban** columns (New · Quoted · Countered · Accepted/Deposit · In progress · Awaiting approval · Balance · Ready/Shipped · Closed) with drag disabled for transitions that need payment (only allowed manual moves); card = WO number, customer, title, budget, needed-by (red if < 7 days), age. List view toggle. **Detail** `/admin/custom/[wo]`: request + references, customer info, thread + composer, and a **Quote builder** (line items: materials, hours × rate, design fee, packaging; subtotal; auto deposit/balance split from settings; timeline days; revisions; scope; valid-until default 7 days; "Send quote"), actions: Decline (reason templates, e.g. "Licensed character", "Can't meet date"), Respond to counter (accept counter / send new quote), Upload progress photos (moves to IN_PROGRESS), Request approval, Send balance link, Mark shipped. Every action appends a timeline event and (later) triggers email/WhatsApp.
- **Customers**: table, detail with orders + work orders + WhatsApp link.
- **Reviews**: moderation queue (publish/hide).
- **Coupons**: CRUD.
- **Content**: home tape items, hero sub-copy, featured products, drops (with countdown date).
- **Settings**: store contact (WhatsApp, email), shipping (domestic rate, free threshold, intl zones table editor), COD (enabled, cap, fee), gift wrap price, custom orders (deposit %, quote validity days, response-time text), policies (rich text per policy page), legal entity + grievance officer details.
- Admin guard in Phase 1: `proxy.ts` redirects `/admin/*` to `/login?next=` when the mock session cookie `fbf_role` ≠ `admin` (optimistic only; real check server-side in Phase 3).

### 2.16 Content & legal pages
`/about`, `/contact` (form → mock; WhatsApp, email, hours), `/faq` (Accordion: lead times, custom orders, payments, COD, shipping intl, returns, care, licensed characters), `/size-guide`, `/care-guide`, `/drops`, `/policies/[slug]` for `shipping`, `refund` (custom non-returnable; ready-to-ship 7-day exchange/refund with unboxing video; refunds 5–7 business days), `terms`, `privacy` (DPDP Act 2023: consent, purposes, retention, deletion request contact), `grievance` (officer name/email/phone placeholders, 48h acknowledgment, 1-month resolution). Write real draft policy text with `[PLACEHOLDER]` for legal names/addresses and a visible "Draft — review before launch" note in dev. Long-form pages use a Read-mode layout: 68ch column, clear headings, table of contents on desktop.

### 2.17 Global states & polish
- `app/loading.tsx` (HookSpinner), `app/error.tsx` ("A stitch slipped" + retry), `app/not-found.tsx` (loose-thread illustration built from the Thread primitive + "Back to the shelf").
- `sitemap.ts`, `robots.ts`, icons (`icon.tsx` from FFMonogram placeholder), `opengraph-image.tsx` default.
- Page transitions: none heavy; optionally View Transitions for product image → PDP (read `02-guides/view-transitions.md`), only if smooth.
- Accessibility: skip link, landmarks, one H1 per page, alt text from data, colour contrast AA verified, all motion respects `prefers-reduced-motion`, Drawer/Modal focus traps (Radix), 44px targets.

### 2.18 Phase 1 finish (required)
1. `npm run lint && npm run typecheck && npm run build` clean.
2. Screenshots: `.impeccable/review/desktop.png` (1440 full page, home), `.impeccable/review/mobile.png` (390), plus PDP, custom form, account WO detail, admin Kanban at both widths. Settle motion before capture.
3. Run `~/.claude/skills/impeccable/scripts/impeccable detect --json web/src` once; fix mechanical findings.
4. Spawn the impeccable finish reviewer with the direction contract, screenshots, detector output; act on its disposition (max 2 rounds).
5. Spawn the impeccable documenter → writes `DESIGN.md` + `.impeccable/design.json` from the built world.
6. Update root `CLAUDE.md` with commands and architecture.

---

## 3. Phase 2 — Backend (`api/`)

### 3.1 Setup
- `npx @nestjs/cli new api --package-manager npm --strict`; add `prisma @prisma/client`, `@nestjs/config`, `@nestjs/throttler`, `class-validator class-transformer`, `argon2`, `@nestjs/jwt`, `cookie-parser`, `helmet`, `razorpay`, `cloudinary`, `multer`, `sharp`, `resend`, `zod` (for shared schemas), `nestjs-pino` (logging).
- `docker-compose.yml` at repo root: Postgres 16 + (optional) Redis; `api/.env.example`: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_ORIGIN`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CLOUDINARY_URL`, `RESEND_API_KEY`, `MAIL_FROM`, `WHATSAPP_NUMBER`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (seed only).
- `packages/shared/` — move zod schemas + status enums from `web/src/lib/schemas` and `lib/types.ts` here; both apps import them (npm workspaces at repo root: `"workspaces": ["web","api","packages/*"]`).

### 3.2 Port from reference projects (adapt, trim, TypeScript)
| Source | Target | Notes |
|---|---|---|
| HomeKrafted `server/src/common/guards/{jwt-auth,roles}.guard.ts`, `decorators/{roles,current-user,public}.decorator.ts` | `api/src/common/` | Drop admin-scope guard (single admin role) |
| HomeKrafted `server/src/auth/hashing.ts` (argon2) | `api/src/auth/` | |
| CityFreshKart `server/middleware/auth.js` cookie helpers + `token_version` | `api/src/auth/cookies.ts` | httpOnly, `SameSite=Lax`, `Secure` in prod; access 15 min, refresh 30 days rotating (HomeKrafted `RefreshToken` model) |
| HomeKrafted `server/src/payments/{razorpay.client,razorpay-signature.util,payments.service}.ts` | `api/src/payments/` | Raw-body webhook verification; add Payment Links for deposit/balance |
| CityFreshKart `server/routes/razorpay.js` COD flow | `api/src/payments/cod.ts` | Rules §6 of PLAN |
| HomeKrafted `server/src/uploads/storage/*`, `image-pipeline.ts` | `api/src/uploads/` | Cloudinary driver + local driver |
| HomeKrafted `server/src/notifications/providers/email.provider.ts` | `api/src/notifications/` | Resend only |
| HomeKrafted `server/src/whatsapp/whatsapp.service.ts` | `api/src/whatsapp/` | Phase 4b (Cloud API templates) — stub now |
| CityFreshKart `server/utils/apiErrors.js` | `api/src/common/errors.ts` | Consistent `{ code, message, fields }` |
| E-Com `server/database/schema.sql` products/variants/reviews/coupons | Prisma models | Shape reference only |

### 3.3 Prisma schema (`api/prisma/schema.prisma`) — first cut
Models (fields per `docs/PLAN.md` §5, plus): `User`, `RefreshToken`, `Address`, `Category`, `Product` (+ `batch Int @unique @default(autoincrement())`), `ProductImage`, `ProductVariant`, `Cart`, `CartItem`, `WishlistItem`, `Order`, `OrderItem` (snapshot fields), `OrderEvent`, `CustomRequest`, `CustomRequestImage`, `CustomMessage`, `Quote`, `Payment` (`purpose ORDER|DEPOSIT|BALANCE`, `razorpayOrderId`, `razorpayPaymentId`, `razorpayPaymentLinkId`, `status`, `amount`), `WebhookEvent` (`provider`, `eventId @unique`, `payload Json`, `processedAt`), `IdempotencyKey`, `Review`, `Coupon`, `CouponRedemption`, `Setting` (`key @id`, `value Json`), `Banner`/`Drop`, `AuditLog` (admin actions). Enums mirror `lib/types.ts` statuses. Money as `Int` paise. Indexes on `Order.number`, `CustomRequest.number`, `Product.slug`, `Order.userId`, status columns. Seed script `prisma/seed.ts` loads the same sample catalogue as the web mock (import from `packages/shared/seed`).

### 3.4 API surface (REST, JSON, cookie auth) — web mock layer must match
| Method & path | Auth | Purpose |
|---|---|---|
| POST `/auth/signup` `/auth/login` `/auth/logout` `/auth/refresh` | public | cookies set/cleared |
| GET `/auth/me` | user | current user |
| POST `/auth/forgot` `/auth/reset` | public | email token flow |
| GET `/categories` · GET `/products?category&q&sort&min&max&availability&colour&occasion&page` · GET `/products/:slug` | public | catalogue |
| GET `/shipping/check?country&postal` | public | serviceability + ETA (mock table first, Shiprocket later) |
| GET/PUT `/cart` · POST `/cart/items` · PATCH/DELETE `/cart/items/:id` · POST `/cart/merge` | guest (session id) or user | server cart |
| GET/POST/DELETE `/wishlist` | user | |
| POST `/coupons/validate` | public | |
| POST `/checkout/quote` | public | server-computed totals (never trust client prices) |
| POST `/orders` | guest/user | creates order + Razorpay order or COD; `Idempotency-Key` header |
| POST `/payments/razorpay/verify` | guest/user | signature check → PAID |
| POST `/payments/razorpay/webhook` | Razorpay | raw body, HMAC, dedupe by event id |
| GET `/orders` · GET `/orders/:number` | user | |
| POST `/orders/track` | public | number + phone/email |
| POST `/orders/:number/cancel` · POST `/orders/:number/return` | user | |
| POST `/custom` (multipart refs) · GET `/custom` · GET `/custom/:wo` | user | work orders |
| POST `/custom/:wo/messages` | user | |
| POST `/custom/:wo/quotes/:id/accept` → returns deposit payment link/order | user | |
| POST `/custom/:wo/quotes/:id/counter` · `/decline` | user | max 2 counters |
| POST `/custom/:wo/approve` · `/request-change` | user | |
| POST `/reviews` (verified buyers) | user | |
| GET/PATCH `/account/profile` · CRUD `/account/addresses` · POST `/account/password` · POST `/account/delete-request` | user | |
| `/admin/*`: dashboard, products CRUD + images, categories, orders (list, detail, status transitions, AWB), custom (list, detail, quote create, decline, progress photos, request approval, balance link, ship), customers, reviews, coupons, content, settings, uploads | admin | all write actions logged to `AuditLog` |

State transitions for orders and work orders live in **one** service each (`OrderStateService`, `CustomStateService`) with an explicit allowed-transition table; controllers never set status directly. Each transition: writes event, sends email (Phase 4), returns updated entity.

### 3.5 Security & quality
- Helmet, CORS to `WEB_ORIGIN` with credentials, throttler (auth routes 5/min/IP, others 100/min), DTO validation (`whitelist`, `forbidNonWhitelisted`), prices always recomputed server-side, uploads type/size checked + re-encoded via sharp (strips EXIF), rate-limited quote counters, admin routes behind `RolesGuard('admin')`, no stack traces in responses.
- Tests: Jest unit tests for state machines, pricing (COD eligibility, shipping, coupons, deposit split), signature verification; e2e (supertest) for auth, checkout, custom flow.

**Done when:** `docker compose up -d && npm run -w api prisma:migrate && npm run -w api seed && npm run -w api start:dev` serves all endpoints; tests pass.

---

## 4. Phase 3 — Integrate
- Set `NEXT_PUBLIC_USE_MOCK=false`; fix any contract drift in `lib/api/*` (not in pages).
- Server components fetch catalogue (product/category pages SSR/ISR with `revalidate`), client components for cart/account.
- Real auth: `proxy.ts` optimistic redirect using presence of the access cookie + role claim; real authorization is the API.
- Admin uploads go to Cloudinary via API.
- Dynamic OG images, sitemap from API, JSON-LD.

## 5. Phase 4 — Payments & notifications
- Razorpay test mode: Checkout.js loader (`lib/payments/razorpay.ts`, port from HomeKrafted), order payment, deposit + balance via Payment Links (or Orders), webhook handling, refunds from admin.
- International cards: enable in Razorpay dashboard; charge INR.
- COD: eligibility enforced server-side; admin "Confirm COD" after WhatsApp.
- Email (Resend) templates for: signup welcome, order placed/confirmed/shipped/delivered/cancelled, work order received/quoted/counter received (admin)/accepted/deposit paid/progress photo/awaiting approval/balance due/shipped, password reset. Brand them with tokens (cream/cocoa, Modak via image header or fallback font).
- WhatsApp: every page's wa.me links wired to settings number. Phase 4b: Cloud API utility templates for order/work-order status (port HomeKrafted service).
- Shipping: mock rate table → Shiprocket serviceability + rates for India (optional in v1); intl zone table from settings.

## 6. Phase 5 — Harden & launch
- Playwright e2e: browse → add to cart → checkout (Razorpay test) → confirmation; COD eligibility; custom request → admin quote → counter → accept → deposit → progress → approve → balance → ship; auth flows; admin product CRUD. Axe accessibility checks on key pages.
- Performance on mid-range Android profile (Lighthouse mobile ≥ 85, LCP < 2.5s), image sizes, GSAP only loaded on home.
- impeccable `audit` + `polish` passes; fix findings.
- Deploy: web → Vercel; api + Postgres → VPS (pm2 + nginx, port HomeKrafted `ecosystem.config.cjs`, `scripts/deploy.sh`) or Railway/Render; daily DB backup script.
- Razorpay website verification checklist: all policy pages live, contact details, pricing visible.
- Replace placeholders: logo files, sample photos (delete `public/samples`), maker note, Instagram handle, WhatsApp number, legal details.

---

## 7. Open items needing the user
- Logo files (PNG/SVG) — swap `LogoMark.tsx` + icons.
- Real products: names, prices, photos (≥ 2000px, 4:5), lead times, fibers, sizes.
- WhatsApp business number, email, legal name + address, grievance officer.
- Razorpay (test keys), Cloudinary, Resend accounts; domain.
- International countries/zones and rates confirmation.
- Maker name/photo/short note for the home page.

---

## 8. Suggested prompts for each Sonnet session
Run one phase/task group per session; start each with:
> Read CLAUDE.md, PRODUCT.md, docs/PLAN.md, docs/IMPLEMENTATION_PLAN.md and .impeccable/surfaces/web-src-app-page-tsx.md. Invoke the impeccable skill (read reference/craft-floor.md) and emil-design-eng. Implement Task(s) X.Y–X.Z exactly as specified, check every "Done when", run lint/typecheck/build, then commit.

Order of sessions: (1) Tasks 1.1–1.2 + 2.1–2.3 → (2) 2.4–2.6 → (3) 2.7 home → (4) 2.8–2.9 → (5) 2.10–2.12 → (6) 2.13–2.14 → (7) 2.15 admin → (8) 2.16–2.18 finish → (9) Phase 2 setup + schema + auth → (10) catalogue/cart/orders API → (11) custom/admin API → (12) Phase 3 → (13) Phase 4 → (14) Phase 5.
