# Build guide for page-building agents

Read this, then `CLAUDE.md`, `PRODUCT.md`, `docs/PLAN.md` (data model, state machines, business rules), the relevant parts of `docs/IMPLEMENTATION_PLAN.md` for your pages (section numbers are given in your brief), and `~/.claude/skills/impeccable/reference/craft-floor.md` (bans and checks). Then look at the finished landing page for the visual language: `web/src/app/(store)/page.tsx`, `web/src/components/home/*`, `web/src/components/brand/*`, `web/src/components/store/ProductTicket.tsx`.

## Stack facts (Next.js 16, not the Next.js you know)
- App Router in `web/src/app`. `params` and `searchParams` are **Promises**: `const { slug } = await props.params`. Server pages type them inline: `{ params: Promise<{ slug: string }> }`.
- `middleware.ts` is now `src/proxy.ts` (already written; guards `/admin` and `/account` optimistically).
- Client components can't export `metadata`. Pattern: `page.tsx` is a **server** component that exports `metadata` and renders a `"use client"` component (e.g. `ShopClient.tsx`). Put client components next to the page or under `src/components/<area>/`.
- Read `web/node_modules/next/dist/docs/01-app/` before using an unfamiliar Next API.
- Tailwind v4: tokens live in `web/src/app/globals.css` (`@theme static`). Use classes such as `bg-cream text-cocoa bg-paper bg-kraft rounded-ticket shadow-ticket shadow-lift font-display font-stencil tabular`. There is no tailwind.config.

## Data layer (mock now, real API later)
All data goes through `web/src/lib/api/*.ts` (async functions, simulated latency, localStorage DB in `web/src/lib/mock/db.ts`). **Pages must only call these functions**, never touch `db` directly, so the swap to the real NestJS API is config-only. Available modules: `auth`, `catalog`, `orders`, `account`, `custom`, `admin`, `shipping`, `settings`, `reviews`. Read the exported signatures before you use them. Totals come from `lib/pricing.ts` via `orders.quote()`; status labels/stamps from `lib/status.ts`; formatting from `lib/format.ts`; WhatsApp links from `lib/whatsapp.ts`.
- Client data hook: `useApi(fn, key, enabled?)` from `lib/api/useApi`: returns `{ data, error, loading, reload }`. `key` must change whenever the inputs change.
- Errors: API functions throw `ApiError` (`status`, `message`, `fields?`). Show `message` to the user; map `fields` onto form fields.
- Auth: `useAuth()` (`user`, `loading`, `login`, `signup`, `logout`). Wrap protected client pages in `<RequireAuth>` (`role="admin"` for admin, already done by the admin layout).
- Cart/wishlist: `useCart()` from `lib/state/CartContext` (`lines`, `add`, `setQty`, `remove`, `clear`, `setOpen`, `wishlist`, `toggleWish`, ...).
- Mock logins: `maya@example.com` (customer, has orders and work orders), `admin@fuzzball.test` (admin), both password `fuzzball123`. Sample data is labelled SAMPLE; there are **no reviews seeded** (show an honest empty state; never invent reviews, ratings or counts).
- If you need an API function that doesn't exist, add it **in a new file you own** (`lib/api/<area>-extra.ts`) using `db` and `wait`; do not edit other people's files. Append-only edits to `lib/status.ts`, `lib/constants`, `globals.css` (under a `/* ── <your area> ── */` comment) are OK. Never rewrite shared files with Write.

## UI kit (use it, don't reinvent)
`components/ui`: `Button` (variants primary/secondary/ghost/tape, sizes sm/md/lg, `asChild`), `Badge`, `Reveal`, `Field` + `Input`/`Textarea`/`Select`/`Checkbox`/`Radio`, `SwatchPicker`, `QuantityStepper`, `Price`, `Skeleton`, `HookSpinner`, `EmptyState`, `ErrorNote`, `PageHeader`, `Modal`, `Drawer`, `Tabs*`, `Accordion*`, `Timeline` + `EventLog`, `OrderStamp`/`CustomStamp`, `ImageUploader`, `RequireAuth`. Brand: `Ticket` (tone kraft|paper, `head`), `Stamp`, `YarnBall`, `CrochetHook`, `LogoMark`, `Tape`. Store: `ProductTicket`. Admin: `components/admin/ui` (`AdminPage`, `Panel`, `TableWrap`, `Th`, `Td`).
Forms: `react-hook-form` + `zod` + `@hookform/resolvers/zod`; `Field` supplies the aria wiring via render-prop. Toasts: `import { toast } from "sonner"`.

## Non-negotiables (from the craft floor and this project)
- **Rose is reserved for the yarn thread and the single live/active state.** Not for decoration.
- No eyebrow labels above headings, no gradient text, no glassmorphism, no colored `border-left` cards, no hard offset shadows, no emoji/unicode as icons (use `lucide-react`, strokeWidth 1.8), no same-size icon+heading+text card grids as page structure, no nested cards. Elevation is shadow **or** border, never both. Card radius 14px (`rounded-ticket`), inputs 12px, buttons are pills.
- Body measure ≤ 68ch. Display type is `font-display` (Modak) for headings/page titles, `font-stencil` for addresses/IDs/stamps, Figtree for everything else. Modak only for large text (≥ 1.75rem).
- Every interactive element: hover gated `[@media(hover:hover)_and_(pointer:fine)]:hover:…`, `:active` press (`press` class), visible focus, disabled, loading state. Touch targets ≥ 44px. Every list: empty state. Every fetch: skeleton + error (`ErrorNote` with retry).
- Motion: one purposeful moment per screen, ease-out (`--ease-out`), < 300ms for UI, no animation on keyboard-driven actions, everything respects `prefers-reduced-motion`, never animate from `scale(0)`.
- Copy: controls name their action ("Add to cart", "Send work order", "Accept quote"). Errors say the problem and the fix. Never invent claims (reviews, counts, press, "loved by").
- Mobile first: design at 390px, then widen. No horizontal page scroll. Test 390, 768, 1440 mentally against every layout.
- Placeholders: anything that is stand-in content (copy, policy text, legal names) gets `// PLACEHOLDER(id): …` in code, `data-placeholder="id"` on a `relative` element, and a row in `docs/PLACEHOLDERS.md` (append only).
- Accessibility: one `h1` per page, landmarks, labels on every control, `aria-live` for async results, focus management in dialogs (Radix does it), colour is never the only signal.

## Verification (do this, but do NOT run `next dev` / `next build`; other agents share this folder)
1. `cd web && npx tsc --noEmit` must be clean for your files (ignore errors that clearly belong to another agent's in-progress files; re-run once after a minute).
2. `npx eslint <your dirs>` must be clean. Fix warnings too.
3. Re-read your JSX once at 390px width in your head: overflow, wrapping, tap targets.
4. Report: files created, routes, any API functions you added, anything you could not finish, any placeholder you tagged. Do not commit.
