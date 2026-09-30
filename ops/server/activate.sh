#!/usr/bin/env bash
# Runs ON the server (as the deploy user). Switches the live site to an uploaded release, waits for it to be healthy,
# and switches back if it is not.
#
#   activate.sh <release-id>     make releases/<id> live
#   activate.sh --rollback       make the previous release live again
#
# Layout under /var/www/fuzzball:
#   releases/<id>/{api,web,RELEASE.env}   one directory per deploy (built on CI, nothing is built here)
#   current  -> releases/<id>             the live release (a symlink, swapped atomically)
#   previous -> releases/<id>             what `current` was before the last switch
#   shared/uploads, shared/next-cache     survive releases
#
# The database is NOT touched here: migrations already ran (expand/contract: the new schema works with the old code),
# so a rollback is a symlink swap plus restart.
set -euo pipefail

ROOT="${FUZZBALL_ROOT:-/var/www/fuzzball}"
KEEP="${FUZZBALL_KEEP_RELEASES:-5}"
API_HEALTH="${FUZZBALL_API_HEALTH:-http://127.0.0.1:4100/health/ready}"
WEB_HEALTH="${FUZZBALL_WEB_HEALTH:-http://127.0.0.1:3100/}"
WAIT_SECONDS="${FUZZBALL_HEALTH_WAIT:-60}"

log() { printf '[activate] %s\n' "$*"; }
die() { printf '[activate] ERROR: %s\n' "$*" >&2; exit 1; }

current_id() { [ -L "$ROOT/current" ] && basename "$(readlink "$ROOT/current")" || true; }

# Point `link` at releases/<id> in one atomic rename.
point() {
  local link="$1" id="$2"
  ln -sfn "$ROOT/releases/$id" "$ROOT/$link.tmp"
  # GNU mv (the server) has -T; BSD mv (a Mac running the tests) has -h for the same thing.
  mv -Tf "$ROOT/$link.tmp" "$ROOT/$link" 2>/dev/null || mv -fh "$ROOT/$link.tmp" "$ROOT/$link"
}

# Overridable so the script can be tested without systemd (ops/test/activate-test.sh).
RESTART_CMD="${FUZZBALL_RESTART_CMD:-sudo -n /usr/bin/systemctl restart fuzzball-api fuzzball-web}"
restart() {
  bash -c "$RESTART_CMD"
}

healthy() {
  local waited=0
  while [ "$waited" -lt "$WAIT_SECONDS" ]; do
    if curl -fsS -m 3 -o /dev/null "$API_HEALTH" && curl -fsS -m 3 -o /dev/null "$WEB_HEALTH"; then return 0; fi
    sleep 2
    waited=$((waited + 2))
  done
  return 1
}

if [ "${1:-}" = "--rollback" ]; then
  [ -L "$ROOT/previous" ] || die "no previous release to go back to"
  target="$(basename "$(readlink "$ROOT/previous")")"
  [ -d "$ROOT/releases/$target" ] || die "previous release $target is gone"
  was="$(current_id)"
  log "rolling back $was -> $target"
  point current "$target"
  [ -n "$was" ] && point previous "$was"
  restart
  healthy || die "release $target did not become healthy after the rollback: look at journalctl -u fuzzball-api -u fuzzball-web"
  log "rolled back to $target"
  exit 0
fi

id="${1:-}"
[ -n "$id" ] || die "usage: activate.sh <release-id> | --rollback"
[[ "$id" =~ ^[A-Za-z0-9._-]+$ ]] || die "bad release id"
dir="$ROOT/releases/$id"
[ -d "$dir/api" ] && [ -d "$dir/web" ] || die "release $id is not fully uploaded ($dir)"

# Shared state is linked in, never copied: uploads and Next's cache outlive every release.
mkdir -p "$ROOT/shared/uploads" "$ROOT/shared/next-cache"
rm -rf "$dir/web/.next/cache"
ln -sfn "$ROOT/shared/next-cache" "$dir/web/.next/cache"

old="$(current_id)"
old_prev="$([ -L "$ROOT/previous" ] && basename "$(readlink "$ROOT/previous")" || true)"
[ "$old" = "$id" ] && log "release $id is already live; restarting it"
[ -n "$old" ] && [ "$old" != "$id" ] && point previous "$old"
point current "$id"
log "current -> $id (was ${old:-nothing})"
restart

if healthy; then
  log "release $id is healthy"
else
  log "release $id did not become healthy within ${WAIT_SECONDS}s"
  if [ -n "$old" ] && [ "$old" != "$id" ] && [ -d "$ROOT/releases/$old" ]; then
    log "switching back to $old"
    point current "$old"
    # The failed release never really became live: `previous` goes back to what it was, so a rollback still works.
    if [ -n "$old_prev" ] && [ -d "$ROOT/releases/$old_prev" ]; then point previous "$old_prev"; else rm -f "$ROOT/previous"; fi
    restart
    healthy && log "back on $old" || log "WARNING: $old is not healthy either; investigate now"
  fi
  exit 1
fi

# Keep the newest $KEEP releases, never the live or the previous one.
cd "$ROOT/releases"
live="$(current_id)"; prev="$([ -L "$ROOT/previous" ] && basename "$(readlink "$ROOT/previous")" || true)"
# shellcheck disable=SC2012
ls -1t | tail -n +"$((KEEP + 1))" | while read -r old_release; do
  [ "$old_release" = "$live" ] && continue
  [ "$old_release" = "$prev" ] && continue
  log "removing old release $old_release"
  rm -rf -- "$ROOT/releases/${old_release:?}"
done
log "done"
