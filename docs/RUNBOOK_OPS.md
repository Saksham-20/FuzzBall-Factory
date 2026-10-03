# Operations runbook

Day-to-day checks, alerts and the usual fixes. Restores are in `docs/RUNBOOK_DR.md`; deploying is in `docs/DEPLOY_PROD.md`.

## What to watch

| Signal | How | Alert when |
|---|---|---|
| Site and API up | Uptime monitor (UptimeRobot, Better Stack) on `https://<domain>/api/health/ready` every minute, and on `https://<domain>/` | 2 failed checks in a row. `/health/ready` is 503 while the database is down, migrations are unfinished, or the API is shutting down |
| Errors | Sentry (`SENTRY_DSN` in `api.env`): failed refunds, payment mismatches, job crashes, emails that gave up, unexpected 500s, and storefront crash screens (`area=web`, sent by the browser through the API). Server-side render errors are only in `journalctl -u fuzzball-web`; the visitor's error screen shows the same `Ref` digest | Any new issue; route alerts to the maker's email and phone |
| Disk and memory | The VPS provider's alerts (or `node_exporter` + alert rule) | Disk over 80%, memory over 90% for 10 minutes |
| Backups | The nightly job's exit status (`systemctl status fuzzball-backup`), and the file dates in the bucket | No new file in 26 hours |
| TLS | Let's Encrypt renews by timer; monitor certificate expiry on the uptime monitor | Under 14 days left |

A forced-failure check once before launch: stop the API (`sudo systemctl stop fuzzball-api`) and confirm the monitor alerts within the expected time, then start it.

## Looking at things

```bash
journalctl -u fuzzball-api -f                          # JSON lines: level, msg, reqId (find one request across lines)
journalctl -u fuzzball-api --since '1 hour ago' | grep '"level":50'   # errors only
systemctl status fuzzball-api fuzzball-web
curl -s localhost:4100/health/ready                     # from the server
/var/www/fuzzball/current/RELEASE.env                   # which commit is live
```

Logs never contain passwords, tokens, reset links or query strings (redacted in `api/src/common/logging.ts`). A customer's
`x-request-id` (shown on API errors as `X-Request-Id`) finds their request.

## Usual problems

| Symptom | Likely cause | Fix |
|---|---|---|
| Deploy job red, "did not become healthy" | New release crashed at boot (bad env value, failed migration) | The server already switched back. `journalctl -u fuzzball-api --since '10 min ago'`; fix and redeploy |
| API won't start: "Invalid environment configuration" | A value in `/etc/fuzzball/api.env` is missing or weak | The message lists every problem; edit, `sudo systemctl restart fuzzball-api` |
| Customers see "Snagged a thread" on product pages | API unreachable from the storefront (it reads the catalogue server side) | Check the API; pages recover by themselves once it answers (cache is 2 minutes) |
| 429 from `/api/auth/...` | nginx or the API's login lock-out working as intended | Wait; an account locked after 5 wrong passwords lifts in 15 minutes |
| Emails not arriving | Resend problem, or the outbox is retrying | Admin > Emails ("Gave up" lists the ones to resend by hand), or `select * from "EmailOutbox" where status <> 'SENT'`; rows retry on a 1/5/15/60/240 minute schedule, then show FAILED and alert |
| Payment taken, order still "pending" | Webhook delayed or blocked | The storefront polls for ~30 s; Razorpay retries the webhook for 24 h; check Razorpay's webhook log; the `razorpay/verify` call from the browser also settles it |
| Disk filling | Logs, dumps, uploads | `journalctl --vacuum-size=500M`; `/var/backups/fuzzball` keeps 10 pre-migration and 3 nightly dumps; uploads are on Cloudinary in production |

## Support inbox

Every contact message, grievance, takedown notice and data request lands in **Admin > Support** and the shop inbox gets a `ticket.new_admin` email. The dashboard shows open, due-soon and overdue counts.

**Clocks.** Acknowledge within 48 hours; resolve a grievance or data request within 30 days (a message or takedown notice within 7). The hourly `support.sla` job emails the owner once when a deadline is near and once when it is past. The customer's confirmation email counts as the acknowledgement.

**Answering a grievance in time**
1. Open the ticket from Support (filter "Overdue" or "Due soon" first).
2. Reply in the thread. A reply emails the customer and records the first response. Use a private note for your own reasoning; notes are never shown or sent.
3. If you answered on WhatsApp or the phone, press "I answered them" so the 48 hour clock stops without an email.
4. Press Resolve and write the outcome in the note. That text becomes the register entry and the customer is emailed.
5. A resolved ticket the customer ignores closes by itself after 14 days; a customer reply reopens it.

**Complaints that arrive outside the site** (WhatsApp, phone, post, email): press "Log a request", pick the channel, and set the date the customer actually wrote (the legal clock starts then). Tick "already acknowledged" if you have replied, so no second email goes out.

**Exporting the register.** The "Grievance register" button on Admin > Support downloads number, kind, channel, category, dates, status, linked order and outcome, without names or emails. Keep it for audits; tickets are deleted 3 years after closing.

**When email fails.** The ticket is still saved and shows in Admin > Support. Check Admin > Emails ("Gave up" rows can be resent), or answer on WhatsApp and press "I answered them". A customer who lost their link can write again from the same email address; reply in the new thread.

**Erasure and export.** An open ticket defers an account erasure until it is resolved; erasure scrubs the person's details but keeps the register fields. The account export includes the person's tickets.

## Secrets rotation

Rotate on a schedule (yearly) and immediately after any suspected leak or when someone with access leaves.

| Secret | How |
|---|---|
| JWT secrets | Replace both in `api.env`, restart the API. Everyone is signed out (refresh tokens stop verifying); that is the point |
| Database password | `ALTER ROLE fuzzball PASSWORD '...'` in psql, update `DATABASE_URL` in `api.env` and the `MIGRATE_DATABASE_URL` GitHub secret, restart the API |
| Razorpay key / webhook secret | New key pair in the dashboard, update `api.env`, restart; update the webhook secret in both places in the same minute (payments arriving in between are retried by Razorpay) |
| Resend / Cloudinary / Sentry | New key in the provider, update `api.env`, restart |
| Deploy SSH key | New key pair, `install.sh --deploy-key new.pub` (remove the old line from `/home/deploy/.ssh/authorized_keys`), update the GitHub secret |
| Admin password | Change it in the account page, or reset through the forgot-password flow |

After rotating, deploy nothing until one health check passes.

## Capacity (launch sizing)

One 2 GB VPS runs everything: storefront (cap 450M), API (cap 400M), Postgres (~400M with `ops/postgres/fuzzball.conf`), nginx. That
serves a small shop comfortably (the catalogue is cached server side, images come from Cloudinary). Resize before launch if the
provider's plan is smaller, and when memory stays above 80% or the API's p95 latency climbs. Postgres `max_connections` is 30
against an API pool of 10: change one, change the other.

## Hardening checklist (install.sh does the first four)

- [x] Firewall: only SSH, 80, 443 (`ufw status`)
- [x] fail2ban sshd jail, automatic security updates (no automatic reboot: reboot monthly, check `/var/run/reboot-required`)
- [x] Services run as `fuzzball`, sandboxed by systemd; CI deploys as `deploy` with two sudo commands
- [x] Postgres listens on localhost only (`ops/postgres/`)
- [ ] `sshd_config`: `PasswordAuthentication no`, `PermitRootLogin no` (do by hand, keep a second session open while you test)
- [ ] Provider snapshots enabled as a second, independent backup
