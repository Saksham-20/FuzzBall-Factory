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
5. `docs/research-brief.md` — domain research

## Current state

- **UI is built** (`web/`): landing, shop, product, custom work orders, cart/checkout, track, auth, account, admin, content pages. Runs on a mock data layer (`web/src/lib/api/*`, localStorage) by default (`NEXT_PUBLIC_USE_MOCK`); a real-API switch is being wired.
- `api/` — NestJS + Prisma + Postgres backend, built with unit + e2e tests (`npm test`, `npm run test:e2e`). Endpoint map in `docs/API.md`. Payments run in mock mode until Razorpay keys are set.
- **Placeholders are tagged**: `PLACEHOLDER(id)` in code, `data-placeholder` in the DOM (footer toggle shows them), full registry in `docs/PLACEHOLDERS.md`. Sample photos in `web/public/samples/` are not the maker's products. Keep registry up to date when adding any stand-in.
- Still needed from the maker: logo files, real products/photos/prices, WhatsApp number, legal details, Razorpay/Cloudinary/Resend accounts.

## Commands (web)

```bash
cd web
npm run dev        # http://localhost:3000
npm run build
npm run lint
```

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

Use the `impeccable` skill (craft-floor) + `emil-design-eng` for all UI work. Rose colour is reserved for the yarn thread and active state. No eyebrow labels, gradient text, emoji icons, or invented claims (reviews, counts). Logo is a placeholder component until the user supplies files.

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
