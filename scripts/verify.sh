#!/usr/bin/env bash
# The same checks CI runs, on your machine, before you push:   scripts/verify.sh
#
#   TEST_DATABASE_URL=postgresql://you@localhost:5432/fuzzball_test scripts/verify.sh   also runs the API e2e suite
#   VERIFY_BROWSER=1 scripts/verify.sh                                                  also runs the Playwright specs
#
# Web builds go to their own folders (.next-verify, .next-real) so a running `next start` on .next is not disturbed.
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }

step "api: lint, types, unit, build"
(cd api && npm run lint && npm run typecheck && npm test && npm run build)

if [ -n "${TEST_DATABASE_URL:-}" ]; then
  step "api: e2e (against the _test database)"
  (cd api && npm run test:e2e)
else
  echo "(skipping api e2e: set TEST_DATABASE_URL to a *_test database to include it)"
fi

step "ops: release switching"
ops/test/activate-test.sh

step "web: lint, unit"
(cd web && npm run lint && npm test)

step "web: mock-mode build"
(cd web && NEXT_PUBLIC_USE_MOCK=true NEXT_DIST_DIR=.next-verify npx next build >/dev/null)

step "web: real-API build carries no sample logins"
(cd web && NEXT_PUBLIC_USE_MOCK=false NEXT_PUBLIC_API_URL=https://api.example.com NEXT_PUBLIC_SITE_URL=https://shop.example.com \
  NEXT_DIST_DIR=.next-real npx next build >/dev/null && npm run check:real-bundle -- .next-real)
rm -rf web/.next-verify web/.next-real

if [ "${VERIFY_BROWSER:-}" = "1" ]; then
  step "web: browser tests"
  (cd web && npm run test:e2e)
else
  echo "(skipping browser tests: VERIFY_BROWSER=1 to include them)"
fi

printf '\n\033[1mAll checks passed.\033[0m\n'
