# Production deploy

One VPS, systemd + nginx, releases built in CI and swapped with a symlink. The scripts are in `ops/`
(see `ops/README.md`). The test server on the shared VPS (`docs/DEPLOY_VPS.md`) is a separate, older setup:
it never becomes production, and its database, secrets and admin password are never reused. Production gets a fresh
database and fresh secrets.

## Before the first deploy (needs the maker)

These take days to weeks, so start them early:

| Item | Why it blocks |
|---|---|
| Domain + DNS | TLS certificate, cookies, webhook URL, email domain |
| Razorpay live account (KYC) and international cards enabled | Live payments; `PAYMENTS_MODE=razorpay` |
| Resend account and verified domain (SPF, DKIM, DMARC) | Order, reset and contact emails; required for live payments |
| Cloudinary account | Uploads must not sit on the server's disk with live payments |
| Real products, photos, prices, WhatsApp number, legal text, GSTIN status | `docs/PLACEHOLDERS.md` lists every stand-in; a launch build (`LAUNCH_BUILD=true`) refuses unresolved ones |

## Server (once)

1. A VPS with **at least 2 GB RAM** (web 450M + API 400M + Postgres ~400M + nginx + headroom), Ubuntu 22.04/24.04, SSH by key only.
2. Install **Node 22+** at `/usr/bin/node` and **PostgreSQL 16/17** (the API needs Node >= 22.12: `nestjs-pino`).
3. Point the domain's A/AAAA records at the server.
4. On the server, from a checkout of this repo: `sudo ops/install.sh --yes --domain shop.example.com --email you@example.com`.
   It asks nothing else; read its header first, it changes the firewall and nginx.
5. Database: `sudo -u postgres psql -v app_password="<strong password>" -f ops/postgres/setup.sql`, copy
   `ops/postgres/fuzzball.conf` into Postgres' `conf.d/`, apply the rules in `ops/postgres/pg_hba.md`, restart Postgres.
6. `/etc/fuzzball/api.env`: replace every `__PLACEHOLDER__` (secrets from `openssl rand -base64 48`). The API refuses to boot with a weak or missing value.
7. Backups: create `/etc/fuzzball/backup.env` (keys in `ops/backup/backup.sh`), then `sudo ops/backup/install-backup.sh` and run one backup by hand. Keep the **age private key offline**.

## GitHub (once)

Create an environment named **production** with **required reviewers** (the approval click is the gate on the server key).

| Kind | Name | Value |
|---|---|---|
| Variable | `DEPLOY_HOST` | server address |
| Variable | `DEPLOY_USER` | `deploy` |
| Variable | `NEXT_PUBLIC_API_URL` | `https://<domain>/api` |
| Variable | `NEXT_PUBLIC_SITE_URL` | `https://<domain>` |
| Variable | `NEXT_PUBLIC_WHATSAPP` | digits with country code |
| Variable | `NEXT_PUBLIC_CLOUDINARY_CLOUD` | the cloud name |
| Variable | `LAUNCH_BUILD` | `true` once placeholders are resolved |
| Secret | `DEPLOY_SSH_KEY` | private half of a key made only for deploys (`ssh-keygen -t ed25519`); install the public half with `install.sh --deploy-key` |
| Secret | `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 <host>`, verified against the host key fingerprint in your provider's console |
| Secret | `MIGRATE_DATABASE_URL` | `postgresql://fuzzball:<password>@127.0.0.1:55432/fuzzball` (the local end of the SSH tunnel) |

Branch protection on `main`: require the CI checks and a pull request. The deploy workflow also refuses a commit whose `api`, `web` and `security` checks are not green.

## Every deploy

Run the **Deploy** workflow (Actions tab), approve it. It builds the release, uploads it, takes a pre-migration
dump on the server, applies migrations through the tunnel, switches `current`, and waits for `/health/ready` and the
storefront. A failed health check switches back by itself and the job goes red.

- **Migrations are additive** (expand/contract): a new column or table ships in one release, the code that depends on it in the next, removals in a later one. That is what lets a rollback be a symlink swap. A migration that cannot be made additive needs a maintenance window and a restore plan (`docs/RUNBOOK_DR.md`).
- **Rollback**: `DEPLOY_HOST=... DEPLOY_SSH_KEY=... DEPLOY_KNOWN_HOSTS=... ops/rollback.sh`, or on the server `/var/www/fuzzball/current/activate.sh --rollback`.
- **About 2 seconds of downtime per deploy** (restart; one instance). Acceptable at launch; revisit with a second instance only with Redis-backed shared state.

## First release only

After the first deploy the database holds only migrations. Create the admin and the default shop settings once. The
seed needs the Prisma CLI, which releases do not carry, so run it from your machine (or the CI runner) through the tunnel:

```bash
ssh -N -L 55432:127.0.0.1:5432 deploy@<host> &
cd api && NODE_ENV=production ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='<long, unique>' \
  DATABASE_URL="postgresql://fuzzball:<password>@127.0.0.1:55432/fuzzball" npx prisma db seed
```

`NODE_ENV=production` makes the seed skip the sample users, sample catalogue and sample coupons (`api/prisma/seed.ts`);
never set `SEED_SAMPLES=true` against production. Then sign in to the admin and add the real categories and products.
Remove `ADMIN_EMAIL` and `ADMIN_PASSWORD` from any env file afterwards.

## Staging (the existing test VPS, or a second small box)

Same setup as production with three differences in `/etc/fuzzball/api.env`: `NODE_ENV=production` (so the production checks apply),
`PAYMENTS_MODE=mock` (simulated "test payment", no Razorpay), and its own secrets, database and domain. Put the whole site behind
basic auth and keep search engines out by uncommenting the two marked lines in `ops/nginx/fuzzball.conf`
(`htpasswd -c /etc/nginx/fuzzball.htpasswd <user>`). Do real-money checks with Razorpay **test** keys on staging
(`PAYMENTS_MODE=razorpay` with test key ids) before the live keys ever touch production.

The test VPS predates this layout. Moving it over means running `ops/install.sh` on it, which changes its nginx, firewall and
systemd units: ask before doing that to a shared box, and stop the old `fuzzball-*` units first.

## Rehearsing a risky migration

Restore the newest backup into a scratch database (`ops/backup/restore-drill.sh` shows how), point `DATABASE_URL` at it and run
`npx prisma migrate deploy` from `api/`. Constraints that reject existing rows show up here instead of during a deploy.

## Load and contention tests

`load/k6-shop.js` (header has the commands): browsing at 200 requests a second, 50 buyers racing for a last item (exactly one
order must win), and a webhook replay storm. Run it against staging, never production.

## Stripping the test-server leftovers

Before going live, rotate **every** secret that ever lived on the test VPS (JWT secrets, database password, admin password) and never copy its database.

## Webhook and go-live checklist

- Razorpay dashboard: webhook URL `https://<domain>/api/payments/razorpay/webhook`, events `payment.captured`, `order.paid`, `payment.failed`, `refund.created`, `refund.processed`, `refund.failed`; paste the secret into `RAZORPAY_WEBHOOK_SECRET`, restart the API.
- One real Rs 1 order with a live card, then refund it from the admin.
- An international test order with an international card (needs Razorpay international enabled).
- `curl -I https://<domain>/` shows HSTS and the CSP; `https://<domain>/api/health/ready` answers 200.
- securityheaders.com, SSL Labs, Google Rich Results test on a product page, `sitemap.xml` and `robots.txt` read correctly.
- Uptime monitor and alerts are live (`docs/RUNBOOK_OPS.md`); a backup ran last night and the restore drill was done once (`docs/RUNBOOK_DR.md`).
