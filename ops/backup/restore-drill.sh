#!/usr/bin/env bash
# Monthly restore drill: prove the newest offsite backup can really be restored. It restores into a throwaway database
# (never `fuzzball`), counts rows in the tables that matter, prints the result and drops the scratch database.
# Run as root. Needs the PRIVATE age key file (kept offline: copy it over for the drill, delete it after).
#
#   sudo AGE_IDENTITY=/root/fuzzball-backup.key ops/backup/restore-drill.sh
#
# Record the output (date, backup name, row counts, how long it took) in docs/RUNBOOK_DR.md under "Drill log".
set -euo pipefail

# shellcheck disable=SC1091
. /etc/fuzzball/backup.env
: "${BACKUP_REMOTE:?}" "${AGE_IDENTITY:?path to the age private key}"
scratch="fuzzball_restore_drill"
work="$(mktemp -d)"
cleanup() { sudo -u postgres dropdb --if-exists "$scratch" 2>/dev/null || true; rm -rf "$work"; }
trap cleanup EXIT

start="$(date +%s)"
latest="$(rclone lsf "$BACKUP_REMOTE/db" | sort | tail -1)"
[ -n "$latest" ] || { echo "no backups found in $BACKUP_REMOTE/db" >&2; exit 1; }
echo "restoring $latest"
rclone copyto "$BACKUP_REMOTE/db/$latest" "$work/$latest"
age -d -i "$AGE_IDENTITY" -o "$work/restore.dump" "$work/$latest"

sudo -u postgres dropdb --if-exists "$scratch"
sudo -u postgres createdb "$scratch"
sudo -u postgres pg_restore --no-owner --dbname="$scratch" "$work/restore.dump"

echo "--- row counts in the restored copy ---"
for table in '"User"' '"Order"' '"Payment"' '"Product"' '"CustomRequest"'; do
  printf '%-16s' "$table"
  sudo -u postgres psql -At -d "$scratch" -c "select count(*) from $table"
done
echo "latest migration: $(sudo -u postgres psql -At -d "$scratch" -c 'select migration_name from _prisma_migrations order by finished_at desc limit 1')"
echo "restore took $(( $(date +%s) - start )) s"
