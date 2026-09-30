#!/usr/bin/env bash
# Puts the previous release back (symlink swap + restart + health check). The database is not rolled back:
# migrations are forward-only and additive, so the previous code runs on the current schema. If a migration itself
# was the problem, restore the pre-migration dump instead (docs/RUNBOOK_DR.md).
#
#   DEPLOY_HOST=... DEPLOY_SSH_KEY=... DEPLOY_KNOWN_HOSTS=... ops/rollback.sh
set -euo pipefail
host="${DEPLOY_HOST:?DEPLOY_HOST is required}"
user="${DEPLOY_USER:-deploy}"
key="${DEPLOY_SSH_KEY:?DEPLOY_SSH_KEY is required}"
known="${DEPLOY_KNOWN_HOSTS:?DEPLOY_KNOWN_HOSTS is required}"
remote_root="${DEPLOY_ROOT:-/var/www/fuzzball}"
[ "$user" != "root" ] || { echo "refusing to run as root" >&2; exit 2; }
exec ssh -i "$key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$known" \
  "$user@$host" "'$remote_root/current/activate.sh' --rollback"
