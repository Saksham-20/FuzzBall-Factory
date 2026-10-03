# FuzzBall Factory API

NestJS 12 (Express, ESM) + Prisma 7 + PostgreSQL. Cookie-based JWT auth, Razorpay, Resend, Cloudinary.
Module layout and coding conventions: [`../docs/API.md`](../docs/API.md).

## Requirements

- Node 20.19+ (Prisma 7), npm
- PostgreSQL 15+ running locally

## Setup

```bash
cd api
npm install                      # also runs `prisma generate` (postinstall)
createdb fuzzball                # once
cp .env.example .env             # then fill in secrets (see below)
npm run prisma:migrate           # applies migrations (dev: `prisma migrate dev`)
npm run seed                     # admin, settings, empty shelves (idempotent; no products)
npm run purge-samples            # dry run: lists the old sample rows; add `-- --yes` to delete them
npm run start:dev                # http://localhost:4000  (watch mode)
```

Generate real secrets: `openssl rand -base64 48` for `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`
(production requires 32+ chars and rejects placeholders). Env is validated with zod at boot
(`src/config/env.ts`): a bad or missing variable fails fast with one readable message.
`NODE_ENV` has no default: the API refuses to boot without it (copy `.env.example`, which sets `development`).
In production these must also be set on purpose: `PAYMENTS_MODE` (`razorpay` or `mock`), `WEB_ORIGIN` and
`TRUST_PROXY`; live payments (`razorpay`) additionally require the Razorpay keys and webhook secret,
`CLOUDINARY_URL` and `RESEND_API_KEY`. `HOST` defaults to `127.0.0.1` in production (behind nginx) and
`0.0.0.0` elsewhere; `COOKIE_SECURE` defaults to true in production. One variable is read outside the schema:
`npm run seed` creates no products, customers or coupons. The only seeded login is the admin from `ADMIN_EMAIL` /
`ADMIN_PASSWORD` (the dev `.env.example` uses `admin@fuzzball.test` / `fuzzball123`). A database seeded before
2026-10-03 still holds the old sample rows; `npm run purge-samples` shows them and `-- --yes` removes them
(sample customers with orders and coupons that were really redeemed are kept and reported).

## Scripts

| Script | What it does |
|---|---|
| `npm run start` / `start:dev` / `start:prod` | run once / watch / run compiled `dist/main` |
| `npm run build` | `prisma generate` then `nest build` |
| `npm run lint` | oxlint (type-aware) |
| `npm run typecheck` | `tsc --noEmit` (includes specs) |
| `npm test` | Vitest unit tests (`src/**/*.spec.ts`), no DB needed |
| `npm run test:e2e` | supertest against the real app and a `*_test` database from `TEST_DATABASE_URL` (`test/*.e2e-spec.ts`); refuses any other database and runs `prisma migrate deploy` on it first |
| `npm run prisma:generate` | regenerate the client into `src/generated/prisma` (git-ignored) |
| `npm run prisma:migrate` | `prisma migrate dev` (create + apply a migration; pass `--name x`) |
| `npm run prisma:deploy` | `prisma migrate deploy` (production) |
| `npm run prisma:studio` | browse the data |
| `npm run seed` | idempotent seed (`prisma/seed.ts`, run through `jiti`) |
| `npm run purge-samples` | removes the old sample products, customers and coupons (`prisma/purge-samples.ts`); dry run unless `--yes` |

Reset the local database completely: `npx prisma migrate reset` (drops, re-migrates, re-seeds).

## Operations

- **Install on a server:** `npm ci --omit=dev`. The Prisma CLI is a dev dependency (migrations run from CI or a laptop through a tunnel, never on the box); `scripts/postinstall.mjs` only generates the client where the CLI exists, and the build compiles the client into `dist/`. Two transitive packages of the CLI (`mysql2`, `deepmerge-ts`) are pinned to patched versions through `overrides` in `package.json`.

- **Health:** `GET /health/live` (process up) and `GET /health/ready` (database reachable, every migration finished, 503 once shutdown begins). Point uptime monitors and deploy gates at `ready`.
- **Logs:** one JSON line per request (pino) with `req.id`; send `x-request-id` from nginx and it is kept, otherwise one is minted and echoed in the response header. Authorization, cookies, the Razorpay signature and query strings are never logged. `LOG_LEVEL` overrides the default.
- **Errors:** set `SENTRY_DSN` to send unexpected 500s, job crashes, failed or stuck refunds and payment amount mismatches (tag `area`: `http`, `jobs`, `refunds`, `payments`, `boot`). Request bodies, cookies and headers are stripped before sending.
- **Scheduled jobs** (one instance at a time, Postgres advisory lock): unpaid-order sweep, refund worker, quote expiry, token and webhook purges, idempotency purge. Off under `NODE_ENV=test`.
- **Database limits:** `DB_POOL_MAX`, `DB_STATEMENT_TIMEOUT_MS`, `DB_IDLE_TX_TIMEOUT_MS` (see `.env.example`).

## Prisma 7 notes

- The datasource URL lives in `prisma.config.ts` (loaded from `.env`), not in `schema.prisma`.
- Generator is `prisma-client` (ESM) writing to `src/generated/prisma`; import from
  `../generated/prisma/client.js`. The client needs a driver adapter: see `src/prisma/prisma.service.ts`.
- Seed is configured under `migrations.seed` in `prisma.config.ts`.
- Numbers (`FB-1001`, `WO-001`) come from the `Counter` table, not a DB sequence: see
  `src/common/numbering.service.ts`. Money is whole rupees (`Int`).

## Try it

```bash
curl -s localhost:4000/health/ready   # /health/live = process only; ready = db + migrations, 503 while shutting down
curl -si -c jar -H 'content-type: application/json' \
  -d '{"name":"Maya","email":"maya2@example.com","password":"hunter2hunter2"}' localhost:4000/auth/signup
curl -s -b jar localhost:4000/auth/me
curl -si -b jar -c jar -X POST localhost:4000/auth/refresh
curl -si -b jar -X POST localhost:4000/auth/logout
```

Without `RESEND_API_KEY`, emails (welcome, password reset…) are printed to the server console.

## Auth endpoints

| | |
|---|---|
| `POST /auth/signup` `{ name, email, phone?, password }` | 201, user; sets cookies |
| `POST /auth/login` `{ identifier (email or phone), password }` | 200, user; sets cookies |
| `POST /auth/refresh` | 200, user; rotates the refresh token (reuse revokes the whole session family) |
| `POST /auth/logout` | 204; revokes the session, clears cookies |
| `GET /auth/me` | 200 user, or 401 |
| `POST /auth/forgot` `{ email }` | always 204 (never reveals whether the email exists) |
| `POST /auth/reset` `{ token, password }` | 204; sets the password and signs out every device |

Cookies: `fbf_at` (access JWT, 15 min, path `/`) and `fbf_rt` (refresh JWT, 30 days, path `/auth`), both
`HttpOnly; SameSite=Lax`, `Secure` in production (`COOKIE_SECURE` overrides; `false` only for a staging box without HTTPS). `Authorization: Bearer <access>` is accepted for tooling.
Signup/login/forgot/reset are limited to 5 requests per minute per IP; everything else 100/min.


## Commerce quick start (mock payments)

With `PAYMENTS_MODE=mock`, or no Razorpay keys outside production (the default `.env`), online payments run in **mock mode**: `POST /orders` returns `payment.mock: true` and you settle it with
`POST /payments/mock/:paymentId/confirm {"ok": true}`. Mock mode never touches Razorpay, even if keys are set. Set `PAYMENTS_MODE=razorpay` (or just add the keys outside production) with `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` for real (test-mode) payments; mock then disappears. A production box must choose explicitly: `mock` is for a staging box only. Details and the full
endpoint table: [`../docs/API.md`](../docs/API.md#commerce-endpoints-catalogue-checkout-orders-payments-account-reviews-uploads).

```bash
B=localhost:4000
P=$(curl -s $B/products/mug-rug); PID=$(echo "$P" | jq -r .id); VID=$(echo "$P" | jq -r '.variants[0].id')
curl -s -X POST $B/checkout/quote -H 'content-type: application/json' -d "{\"lines\":[{\"productId\":\"$PID\",\"variantId\":\"$VID\",\"qty\":2}],\"country\":\"IN\"}"
curl -s -c jar -X POST $B/orders -H 'content-type: application/json' -H 'Idempotency-Key: demo-0001' -d "{\"lines\":[{\"productId\":\"$PID\",\"variantId\":\"$VID\",\"qty\":2}],
  \"contact\":{\"name\":\"Maya\",\"email\":\"maya@example.com\",\"phone\":\"9800000001\"},
  \"address\":{\"name\":\"Maya\",\"phone\":\"9800000001\",\"line1\":\"12 Lotus Apartments\",\"city\":\"Bengaluru\",\"state\":\"Karnataka\",\"postalCode\":\"560038\",\"country\":\"IN\"},
  \"paymentMethod\":\"RAZORPAY\"}"            # -> order + payment.paymentId
curl -s -X POST $B/payments/mock/<paymentId>/confirm -H 'content-type: application/json' -d '{"ok":true}'
curl -s -b jar $B/orders/FB-1001               # the guest cookie from the POST lets this browser read it
curl -s -X POST $B/orders/track -H 'content-type: application/json' -d '{"number":"FB-1001","contact":"9800000001"}'
```

Uploads go to `./uploads` unless `CLOUDINARY_URL` is set; every image is re-encoded to WebP (max 2000px, EXIF removed).
