#!/usr/bin/env bash
# Exercises ops/server/activate.sh against a scratch directory: switch, previous link, failed health check falling
# back, rollback, and pruning. No server or systemd needed (health is a file:// URL, restart is `true`).
#   ops/test/activate-test.sh
set -euo pipefail

script="$(cd "$(dirname "$0")/../server" && pwd)/activate.sh"
root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
export FUZZBALL_ROOT="$root" FUZZBALL_RESTART_CMD=true FUZZBALL_HEALTH_WAIT=2 FUZZBALL_KEEP_RELEASES=50
export FUZZBALL_API_HEALTH="file://$root/current/HEALTHY" FUZZBALL_WEB_HEALTH="file://$root/current/HEALTHY"

fail=0
check() { if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: expected '$3', got '$2'"; fail=1; fi; }
live() { basename "$(readlink "$root/current")"; }
prev() { basename "$(readlink "$root/previous")"; }
release() { # release <id> <healthy|sick> <age-in-minutes>
  mkdir -p "$root/releases/$1/api" "$root/releases/$1/web/.next"
  [ "$2" = healthy ] && touch "$root/releases/$1/HEALTHY"
  touch -t "$(date -v-"$3"M +%Y%m%d%H%M 2>/dev/null || date -d "$3 minutes ago" +%Y%m%d%H%M)" "$root/releases/$1"
}

release r1 healthy 50; release r2 healthy 40; release r3 sick 30; release r4 healthy 20; release r5 healthy 10; release r6 healthy 5

"$script" r1 >/dev/null;                        check "first release goes live" "$(live)" r1
check "no previous yet" "$([ -e "$root/previous" ] && echo yes || echo no)" no
"$script" r2 >/dev/null;                        check "second release goes live" "$(live)" r2
check "previous is the old one" "$(prev)" r1
check "shared cache is linked in" "$(readlink "$root/releases/r2/web/.next/cache")" "$root/shared/next-cache"

if "$script" r3 >/dev/null 2>&1; then echo "FAIL a sick release was accepted"; fail=1; else echo "ok   a sick release is refused"; fi
check "and the live release is unchanged" "$(live)" r2

"$script" --rollback >/dev/null;                check "rollback goes to the previous release" "$(live)" r1
check "and the rolled-back one becomes previous" "$(prev)" r2

"$script" r4 >/dev/null; "$script" r5 >/dev/null; FUZZBALL_KEEP_RELEASES=3 "$script" r6 >/dev/null
check "newest is live" "$(live)" r6
check "old releases are pruned to the keep count" "$(ls "$root/releases" | wc -l | tr -d ' ')" 3
check "the live and previous releases survive pruning" "$([ -d "$root/releases/$(live)" ] && [ -d "$root/releases/$(prev)" ] && echo yes)" yes

if "$script" "../etc" >/dev/null 2>&1; then echo "FAIL a path-like id was accepted"; fail=1; else echo "ok   a path-like release id is refused"; fi
exit "$fail"
