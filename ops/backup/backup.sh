#!/usr/bin/env bash
# Nightly offsite backup of the database (and the uploads folder when the local disk driver is in use).
# Runs as root from fuzzball-backup.service. Needs /etc/fuzzball/backup.env:
#
#   BACKUP_REMOTE=b2:my-bucket/fuzzball        an rclone remote:path (configure with `rclone config` as root)
#   AGE_RECIPIENT=age1...                      public key; the PRIVATE key is kept offline, not on this server
#   BACKUP_KEEP_DAYS=30                        offsite retention
#   BACKUP_UPLOADS=true                        the default; false only when CLOUDINARY_URL is set (photos live there)
#
# Backups are encrypted BEFORE they leave the machine (age), so the bucket holds nothing readable.
set -euo pipefail

# shellcheck disable=SC1091
. /etc/fuzzball/backup.env
: "${BACKUP_REMOTE:?}" "${AGE_RECIPIENT:?}"
keep_days="${BACKUP_KEEP_DAYS:-30}"
work="$(mktemp -d /var/backups/fuzzball/.upload.XXXXXX)"
trap 'rm -rf "$work"' EXIT

dump="$(/usr/local/sbin/fuzzball-dump nightly)"
name="$(basename "$dump" .dump)"
age -r "$AGE_RECIPIENT" -o "$work/$name.dump.age" "$dump"
rclone copyto "$work/$name.dump.age" "$BACKUP_REMOTE/db/$name.dump.age"

if [ "${BACKUP_UPLOADS:-true}" = "true" ]; then
  tar -C /var/www/fuzzball/shared -cf - uploads | age -r "$AGE_RECIPIENT" -o "$work/$name-uploads.tar.age"
  rclone copyto "$work/$name-uploads.tar.age" "$BACKUP_REMOTE/uploads/$name-uploads.tar.age"
fi

# Offsite retention.
rclone delete --min-age "${keep_days}d" "$BACKUP_REMOTE/db"
[ "${BACKUP_UPLOADS:-true}" = "true" ] && rclone delete --min-age "${keep_days}d" "$BACKUP_REMOTE/uploads"

# Prove the copy is there and has the size we sent.
remote_size="$(rclone size --json "$BACKUP_REMOTE/db/$name.dump.age" | sed -n 's/.*"bytes":\([0-9]*\).*/\1/p')"
local_size="$(stat -c %s "$work/$name.dump.age")"
[ "$remote_size" = "$local_size" ] || { echo "backup verification failed: remote $remote_size bytes, local $local_size" >&2; exit 1; }
echo "backup ok: $name ($local_size bytes)"
