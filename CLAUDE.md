# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow

Before starting any task, read this file and scan the skills folders (`~/.claude/skills/` and any project `.claude/skills/`). Use the context found there and invoke the best-matching skills and tools for the work.

## Project

FuzzBall Factory — e-commerce site for a solo maker's handmade crochet products (India + international). Shoppers buy ready-to-ship or made-to-order pieces, or submit custom "Work Orders" that the admin quotes, counters, accepts or declines (50% deposit, balance before ship). WhatsApp is the main customer channel.

## Source of truth (read before building)

1. `PRODUCT.md` — product truth, users, brand commitments
2. `docs/PLAN.md` — stack decision, IA, data model, state machines, business rules
3. `docs/IMPLEMENTATION_PLAN.md` — ordered tasks with specs and "Done when" checks. **Follow it task by task.**
4. `.impeccable/surfaces/web-src-app-page-tsx.md` — locked visual direction ("The Factory Floor")
5. `DESIGN.md` — the visual system as built: tokens, components, named rules (sidecar: `.impeccable/design.json`)
6. `docs/research-brief.md` — domain research

Also: `TODOS.md` (deferred work by priority), `plans/` (self-contained fixes for the storefront's motion; `plans/README.md` gives the order), `docs/BUILD_GUIDE.md` (page-building conventions), `docs/DEPLOY_VPS.md` (the test server; real addresses live only in the gitignored `docs/DEPLOY_VPS.local.md`).

## Current state

- **UI is built** (`web/`): landing, shop, product, custom work orders, cart/checkout, track, auth, account, admin, content pages. Runs on a mock data layer (`web/src/lib/api/*`, localStorage) by default; `NEXT_PUBLIC_USE_MOCK=false` sends each call to the real API instead (`web/src/lib/api/real/*`, `NEXT_PUBLIC_API_URL`). Several parts still import `lib/mock/catalog` directly (home, header and footer menus, category pages, product metadata, sitemap; see `TODOS.md`).
- `api/` — NestJS + Prisma + Postgres backend, built with unit + e2e tests (`npm test`, `npm run test:e2e`). Endpoint map in `docs/API.md`. Online payment works in mock mode only: the API fakes it in development without Razorpay keys (in production without keys it is off), and the storefront's live Razorpay checkout isn't wired yet (`settlePayment` in `web/src/lib/api/http.ts` refuses with a 501).
- **Placeholders are tagged**: `PLACEHOLDER(id)` in code, `data-placeholder` in the DOM (footer toggle shows them), full registry in `docs/PLACEHOLDERS.md`. Sample photos in `web/public/samples/` are not the maker's products. Keep registry up to date when adding any stand-in.
- Still needed from the maker: real products/photos/prices, WhatsApp number, legal details, Razorpay/Cloudinary/Resend accounts.

## Commands (web)

```bash
cd web
npm run dev        # http://localhost:3000
npm run build
npm run lint
npm test           # unit (vitest): src/**/*.test.ts
npm run test:e2e   # layout and accessibility regressions in Chromium (Playwright): builds into .next-e2e, serves on :3310
```

`npm run build` writes `web/.next`. If a local `next start` is serving that folder, build into another one: `NEXT_DIST_DIR=.next-verify npx next build`.

## Commands (api)

```bash
cd api
npm run build && npm run lint && npm test   # unit
npm run test:e2e                            # needs local Postgres (see api/README.md)
npm run seed
```

## Next.js 16 notes

This is NOT the Next.js in training data. Read `web/node_modules/next/dist/docs/01-app/` guides before routing/data code. `middleware.ts` → `proxy.ts`; `params`/`searchParams`/`cookies()` are async.

## Design rules

Use the `impeccable` skill (craft-floor) + `emil-design-eng` for all UI work. Rose colour is reserved for the yarn thread and active state. No eyebrow labels, gradient text, emoji icons, or invented claims (reviews, counts). The logo is the maker's own artwork (`web/public/brand/`, rendered by `LogoMark`).

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec
