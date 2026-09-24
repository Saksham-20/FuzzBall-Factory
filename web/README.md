# FuzzBall Factory: web

The storefront, customer account and admin for FuzzBall Factory, built with Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS v4. The project overview is in the [root README](../README.md), and the visual system is in [DESIGN.md](../DESIGN.md).

Next.js 16 differs from older docs and from what most tools remember: for example `middleware.ts` is now `proxy.ts`, and `params`, `searchParams` and `cookies()` are async. Read the guides in `node_modules/next/dist/docs/` before changing routing or data code.

## Commands

Needs Node 20.19 or later.

```bash
npm install
npx playwright install chromium   # once per machine, before the first test:e2e
npm run dev          # http://localhost:3000
npm run lint
npm test             # unit tests (Vitest): src/**/*.test.ts
npm run test:e2e     # layout and accessibility checks in Chromium (Playwright): builds into .next-e2e, serves on :3310
npm run build        # production build into .next
npm run start        # serve that build
```

`npm run build` writes `.next`. If a `next start` is already serving that folder, build into another one instead: `NEXT_DIST_DIR=.next-verify npx next build`.

## Sample data or the real API

By default every function in `src/lib/api/*` runs against a sample database kept in the browser's local storage, so the site works with no backend. Sample logins: `maya@example.com` (a customer with orders and work orders) and `admin@fuzzball.test` (admin), both with the password `fuzzball123`. Clear the site's data in the browser to reset it. While on sample data, the footer has a **Show placeholder tags** switch that outlines every stand-in (see [docs/PLACEHOLDERS.md](../docs/PLACEHOLDERS.md)).

| Variable | Default | What it does |
|---|---|---|
| `NEXT_PUBLIC_USE_MOCK` | on | `false` sends each call to the real API (`src/lib/api/real/*`) |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | where the API lives. Set it explicitly with the real API: `next.config.ts` only adds the API's host to the image allow-list when the variable is set, so uploaded photos break without it |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | the site's own address, for canonical links, the sitemap and share images |
| `NEXT_PUBLIC_WHATSAPP` | a placeholder number | the maker's WhatsApp number |
| `NEXT_DIST_DIR` | `.next` | the build output folder |
| `NEXT_OUTPUT` | unset | `standalone` builds a self-contained server bundle, as the test server uses |

Some parts still read the sample catalogue directly, even with the real API on: the home page, the header and footer category menus, category pages, product page metadata and share images, the sitemap, the shop's colour filter and the product cache (see [TODOS.md](../TODOS.md)).

## Where things live

- `src/app/(store)/`: the storefront: home, shop, product pages, custom work orders, cart, checkout, order tracking, account and content pages
- `src/app/(auth)/`: sign-in, sign-up and password pages
- `src/app/admin/`: the maker's admin
- `src/app/globals.css`: design tokens (`@theme`), shared utilities and motion
- `src/components/`: `home/` (the Factory Floor sections), `brand/` (yarn ball, tickets, stamps, tape), `ui/` (buttons, fields, badges, dialogs), and one folder per area
- `src/lib/api/`: the data layer, with the sample implementation in each file and the API calls in `real/`
- `e2e/`: Playwright specs. Unit tests sit next to the code as `*.test.ts`.

## Deploying

There is no production deploy yet. The test server's setup and redeploy steps are in [docs/DEPLOY_VPS.md](../docs/DEPLOY_VPS.md).
