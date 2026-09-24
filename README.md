# FuzzBall Factory

An online store for one maker's handmade crochet: plushies, bouquets, bags and gifts, crocheted by one pair of hands in India and shipped across India and abroad. Shoppers buy ready-to-ship or made-to-order pieces, or send a custom **Work Order** that the maker quotes, counters, accepts or declines (50% deposit, balance before shipping). WhatsApp is the main way customers reach the maker, so every question on the site opens a prefilled chat.

The look is "The Factory Floor": the store as a tiny handmade factory where yarn goes in, fuzzballs come out, and the production line is the order status. See [DESIGN.md](DESIGN.md).

**Status:** in development. The storefront runs on sample data by default, and the photos in `web/public/samples/` are openly licensed stand-ins, not the maker's products. Online payment works only in mock mode for now: the API fakes it while it runs in development without Razorpay keys, and the storefront's live Razorpay checkout isn't wired yet.

## What's in the repo

| Path | What it is |
|---|---|
| [`web/`](web/) | Next.js 16 storefront, customer account and admin ([web/README.md](web/README.md)) |
| [`api/`](api/) | NestJS + Prisma + PostgreSQL API ([api/README.md](api/README.md)) |
| [`docs/`](docs/) | The plan, API map, build conventions, deploy notes, placeholder registry |
| [`plans/`](plans/) | Self-contained fixes for the storefront's motion, in order ([plans/README.md](plans/README.md)) |
| [`PRODUCT.md`](PRODUCT.md) | Who the store is for, what it must do, brand commitments |
| [`DESIGN.md`](DESIGN.md) | The visual system: tokens, components, rules |
| [`TODOS.md`](TODOS.md) | Deferred work, by priority |
| [`CLAUDE.md`](CLAUDE.md) | Working notes for AI coding agents |

## Quick start

You need Node 20.19 or later and npm. The storefront runs on its own with sample data, no database needed:

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```

Sample logins: `maya@example.com` (customer) and `admin@fuzzball.test` (admin), both with the password `fuzzball123`. The sample data lives in your browser's local storage.

To run against the real API, set up PostgreSQL and the API first ([api/README.md](api/README.md) has the details):

```bash
cd api
npm install
createdb fuzzball
cp .env.example .env     # then fill in the secrets
npm run prisma:migrate
npm run seed
npm run start:dev        # http://localhost:4000
```

Then start the storefront with the sample layer off:

```bash
cd web
NEXT_PUBLIC_USE_MOCK=false NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev
```

Set the API address even though it matches the default: `web/next.config.ts` only adds the API's host to the image allow-list when the variable is set, so uploaded photos break without it.

## Tests

The browser tests need Playwright's Chromium once per machine: `cd web && npx playwright install chromium`.

```bash
cd web && npm test         # unit tests (Vitest)
cd web && npm run test:e2e # layout and accessibility checks in Chromium (Playwright); builds the app first
cd api && npm test         # unit tests (Vitest), no database needed
cd api && npm run test:e2e # the API against your local database
```

## Docs

- [`docs/PLAN.md`](docs/PLAN.md): stack decision, information architecture, data model, order and work-order state machines, business rules
- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md): the build, task by task, with "Done when" checks
- [`docs/API.md`](docs/API.md): API modules, conventions and endpoints
- [`docs/BUILD_GUIDE.md`](docs/BUILD_GUIDE.md): conventions for building pages
- [`docs/PLACEHOLDERS.md`](docs/PLACEHOLDERS.md): every stand-in to replace before launch
- [`docs/DEPLOY_VPS.md`](docs/DEPLOY_VPS.md): the test server
- [`docs/research-brief.md`](docs/research-brief.md): domain research

Still needed from the maker before launch: real products, photos and prices, the WhatsApp number, legal details, and Razorpay, Cloudinary and Resend accounts.
