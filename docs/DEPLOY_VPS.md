# Test deployment on the shared VPS

Test site only: `http://<vps-ip>` (plain HTTP, no domain yet, `X-Robots-Tag: noindex`). The real address, SSH user and host notes live in `docs/DEPLOY_VPS.local.md`, which is gitignored; keep them out of this public file.

| Piece | Where |
|---|---|
| Web (Next.js standalone) | `/var/www/fuzzball/web`, systemd `fuzzball-web`, `127.0.0.1:3100` |
| API (NestJS) | `/var/www/fuzzball/api`, systemd `fuzzball-api`, `127.0.0.1:4100` |
| Uploads | `/var/www/fuzzball/uploads` |
| API env (secrets) | `/etc/fuzzball/api.env` (root:fuzzball, 640) |
| Database | Postgres role `fuzzball`, database `fuzzball` |
| nginx | `/etc/nginx/sites-available/fuzzball` (+ symlink), `server_name <vps-ip>`, not `default_server`. `/api/` strips the prefix and rewrites cookie paths to `/api/...` |
| Run as | system user `fuzzball` (no shell). Memory caps: web 450M, API 400M |

`NODE_ENV=development` on the API on purpose: auth cookies are `Secure` only in production, and this site is HTTP. It also keeps the mock payment mode on (no Razorpay keys). Switch to production once there is a domain + HTTPS.

While it runs in development mode and is reachable from the internet, treat it as open: the mock payment confirm route is public, the JWT secret strength check is skipped, and the seed falls back to the sample admin password unless `ADMIN_PASSWORD` is set. Seed it with a unique `ADMIN_PASSWORD`, use long random JWT secrets that appear nowhere in this repo, and keep real customers off it.

## Redeploy (build on your machine, never on the VPS)

```bash
# web
cd web
NEXT_PUBLIC_USE_MOCK=false NEXT_PUBLIC_API_URL=http://<vps-ip>/api NEXT_PUBLIC_SITE_URL=http://<vps-ip> \
  NEXT_DIST_DIR=.next-vps NEXT_OUTPUT=standalone npx next build
# assemble: standalone + .next-vps/static + public, drop darwin sharp, rsync to /var/www/fuzzball/web/
# (then copy @img/sharp-linux-x64 + sharp-libvips-linux-x64 from api/node_modules/@img into web/node_modules/@img)
# api
cd api && npm run build
rsync -az dist package.json package-lock.json prisma prisma.config.ts <ssh-user>@<vps-ip>:/var/www/fuzzball/api/
# schema change: tunnel 5432 and run `npx prisma migrate deploy` from your machine with the fuzzball DATABASE_URL
ssh <ssh-user>@<vps-ip> 'chown -R fuzzball:fuzzball /var/www/fuzzball && systemctl restart fuzzball-api fuzzball-web'
```

Gotcha: `argon2@0.45.1` prebuilt binary segfaults on this VPS's Node 20. The box runs `argon2@0.44.0`, installed with `npm i argon2@0.44.0 --no-save --ignore-scripts --omit=dev`. Redo that after any `npm ci` in `/var/www/fuzzball/api`.

## Remove everything

```bash
systemctl disable --now fuzzball-api fuzzball-web
rm /etc/systemd/system/fuzzball-{api,web}.service && systemctl daemon-reload
rm /etc/nginx/sites-enabled/fuzzball /etc/nginx/sites-available/fuzzball && nginx -t && systemctl reload nginx
sudo -u postgres psql -c 'DROP DATABASE fuzzball' -c 'DROP ROLE fuzzball'
rm -rf /var/www/fuzzball /etc/fuzzball && userdel fuzzball
```
