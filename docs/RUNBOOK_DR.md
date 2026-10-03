# Disaster recovery

| | Target | How it is met |
|---|---|---|
| RPO (data you can lose) | 24 hours | Nightly encrypted `pg_dump` offsite (`ops/backup/`) plus a dump before every migration. Tighten to ~15 minutes with WAL archiving (pgBackRest or the provider's point-in-time recovery) if the shop's volume justifies it |
| RTO (time to be back) | 2 hours | New server from `ops/install.sh`, restore the dump, deploy the last release |

What is backed up: the database (orders, payments, accounts, catalogue, custom orders, audit log), and the uploads folder
(every product and customer photo lives on the server; `BACKUP_UPLOADS=false` only if Cloudinary is ever switched on). What is not: secrets (keep them in
a password manager, separately), the age **private** key (offline, in two places), and the code (it is in git, releases are rebuilt).

Backups are encrypted with `age` before they leave the server, so the bucket holds nothing readable. **Losing the private key
means losing the backups**: store it in two separate places that are not this server.

## Restore into a scratch database (the drill, monthly)

```bash
sudo AGE_IDENTITY=/root/fuzzball-backup.key ops/backup/restore-drill.sh
```

It restores the newest offsite backup into a throwaway database, prints row counts for the main tables and the latest
migration, how long it took, then drops the copy. Log the result below. Delete the key file from the server afterwards.

### Drill log

| Date | Backup restored | Rows (User / Order / Payment) | Took | By |
|---|---|---|---|---|
| _not yet run_ | | | | |

## Bad deploy (code)

`ops/rollback.sh`, or on the server `/var/www/fuzzball/current/activate.sh --rollback`. The database is left as it is: migrations
are additive, so the previous code runs on the current schema.

## Bad migration (data)

1. Stop writes: `sudo systemctl stop fuzzball-api`.
2. The dump taken just before that deploy is in `/var/backups/fuzzball/<time>-pre-migrate-<release>.dump` (root only).
3. Restore into a new database, check it, then swap names:

```bash
sudo -u postgres createdb fuzzball_restored
sudo -u postgres pg_restore --no-owner --dbname=fuzzball_restored /var/backups/fuzzball/<file>.dump
sudo -u postgres psql -c 'ALTER DATABASE fuzzball RENAME TO fuzzball_broken' -c 'ALTER DATABASE fuzzball_restored RENAME TO fuzzball'
sudo -u postgres psql -d fuzzball -c 'ALTER DATABASE fuzzball OWNER TO fuzzball' 
/var/www/fuzzball/current/activate.sh --rollback      # code that matches the restored schema
```

Orders and payments made after the dump are not in it: list them from Razorpay's dashboard and from the `fuzzball_broken` copy,
and re-enter or refund them by hand. Keep `fuzzball_broken` until that is done.

## Lost server

1. New VPS, same region; point DNS at it (set a low TTL ahead of time).
2. `ops/install.sh` (certificate, nginx, units), Postgres setup (`ops/postgres/`), `/etc/fuzzball/*.env` from the password manager.
3. Restore the newest dump into `fuzzball` (as above, straight into the database instead of a scratch one), then run the **Deploy** workflow against the new host (update `DEPLOY_HOST` and `DEPLOY_KNOWN_HOSTS`). Migrations that are already applied are skipped.
4. Re-register nothing: the Razorpay webhook URL is the domain, which did not change.
5. Check: `/health/ready`, a test order in mock-free mode, the admin, the next backup.

## Compromise

Rotate everything in `docs/RUNBOOK_OPS.md` (secrets rotation), sign everyone out (changing the JWT secrets does it), review the audit log in
the admin and the nginx access log, restore from a clean backup if data was altered, tell affected customers as DPDP requires.
