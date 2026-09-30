#!/usr/bin/env bash
# Ships a release built by ops/build.sh: upload, database dump, migrations, switch, health gate, automatic rollback.
# Runs on the CI runner (or your machine). The server only ever receives a finished artifact.
#
#   ops/deploy.sh <release-id>
#
# Environment:
#   DEPLOY_HOST            server address
#   DEPLOY_USER            default: deploy (never root)
#   DEPLOY_SSH_KEY         path to the private key file
#   DEPLOY_KNOWN_HOSTS     path to a known_hosts file holding the server's host key (host keys are never trusted on first use)
#   MIGRATE_DATABASE_URL   a postgresql connection URL for the tunnel's local end: host 127.0.0.1, port TUNNEL_PORT, the app database
#                          (user and password as set in ops/postgres/setup.sql)
#   TUNNEL_PORT            default 55432
#   DEPLOY_ROOT            default /var/www/fuzzball
#
# Order matters: the schema moves first (expand/contract, so the OLD code keeps working on the NEW schema), then the
# code switches. A failed health check switches the code back; the database stays migrated, which is why every migration
# must be additive. The pre-migration dump on the server is the last resort (docs/RUNBOOK_DR.md).
set -euo pipefail

release="${1:?usage: ops/deploy.sh <release-id>}"
root_dir="$(cd "$(dirname "$0")/.." && pwd)"
host="${DEPLOY_HOST:?DEPLOY_HOST is required}"
user="${DEPLOY_USER:-deploy}"
key="${DEPLOY_SSH_KEY:?DEPLOY_SSH_KEY is required}"
known="${DEPLOY_KNOWN_HOSTS:?DEPLOY_KNOWN_HOSTS is required}"
tunnel_port="${TUNNEL_PORT:-55432}"
remote_root="${DEPLOY_ROOT:-/var/www/fuzzball}"
artifact="$root_dir/dist-release/fuzzball-$release.tar.gz"
migrate_url="${MIGRATE_DATABASE_URL:?MIGRATE_DATABASE_URL is required}"

[ "$user" != "root" ] || { echo "refusing to deploy as root" >&2; exit 2; }
[[ "$release" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "bad release id" >&2; exit 2; }
[ -f "$artifact" ] || { echo "missing $artifact: run ops/build.sh $release first" >&2; exit 2; }

# The migration URL must point at the tunnel's local end, so a typo can never migrate some other database.
case "$migrate_url" in
  postgresql://*@127.0.0.1:"$tunnel_port"/*|postgresql://*@localhost:"$tunnel_port"/*) ;;
  *) echo "MIGRATE_DATABASE_URL must be postgresql://...@127.0.0.1:$tunnel_port/<db>" >&2; exit 2 ;;
esac

ssh_opts=(-i "$key" -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$known" -o ConnectTimeout=15)
remote() { ssh "${ssh_opts[@]}" "$user@$host" "$@"; }

echo "== upload $release =="
scp "${ssh_opts[@]}" "$artifact" "$user@$host:$remote_root/releases/$release.tar.gz"
remote "cd '$remote_root/releases' && rm -rf '$release' && tar -xzf '$release.tar.gz' && rm -f '$release.tar.gz' && test -x '$release/activate.sh'"

echo "== database dump (rollback of last resort) =="
remote "sudo -n /usr/local/sbin/fuzzball-dump pre-migrate-$release"

echo "== migrations =="
control="$(mktemp -u)"
ssh "${ssh_opts[@]}" -f -N -M -S "$control" -L "127.0.0.1:$tunnel_port:127.0.0.1:5432" "$user@$host"
close_tunnel() { ssh -S "$control" -O exit "$user@$host" >/dev/null 2>&1 || true; }
trap close_tunnel EXIT
(cd "$root_dir/api" && DATABASE_URL="$migrate_url" npx prisma migrate deploy)
close_tunnel
trap - EXIT

echo "== switch =="
if remote "'$remote_root/releases/$release/activate.sh' '$release'"; then
  echo "== $release is live =="
else
  echo "== $release FAILED its health check; the server switched back to the previous release ==" >&2
  echo "Logs: ssh $user@$host journalctl -u fuzzball-api -u fuzzball-web --since '10 min ago'" >&2
  exit 1
fi
