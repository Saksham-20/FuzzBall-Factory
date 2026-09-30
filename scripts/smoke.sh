#!/usr/bin/env bash
# Read-only smoke test of a deployed site (no orders, no sign-ins, nothing written):
#
#   scripts/smoke.sh https://fuzzballfactory.com
#
# Checks pages and API answer, unknown products and shelves are REAL 404s (not a 200 "not found" page, which search engines
# keep), security headers are present and never duplicated or in conflict, and the catalogue feeds work.
set -uo pipefail
base="${1:?usage: scripts/smoke.sh <base-url>}"; base="${base%/}"
fail=0
ok()  { printf 'ok    %s\n' "$*"; }
bad() { printf 'FAIL  %s\n' "$*"; fail=1; }
status() { curl -s -o /dev/null -m 20 -w '%{http_code}' "$base$1"; }
expect() { local got; got="$(status "$1")"; [ "$got" = "$2" ] && ok "$1 -> $2" || bad "$1 -> $got (wanted $2)"; }

for p in / /shop /about /wishlist /track /login /signup /cart /contact /faq /policies/shipping /robots.txt /sitemap.xml /feed/google.xml /api/health/ready /api/categories "/api/products?pageSize=2"; do expect "$p" 200; done
expect /no-such-page 404
expect /shop/no-such-shelf 404
expect /p/definitely-not-a-product 404
expect /api/products/definitely-not-a-product 404
expect /api/wishlist 401
expect /api/admin/orders 401

# Every script, stylesheet and font the home and shop pages reference must load (a build deployed without its
# static folder serves fine-looking HTML with no CSS or JS, and status checks on pages alone do not notice).
missing=0; checked=0
while read -r asset; do
  checked=$((checked + 1))
  [ "$(curl -s -o /dev/null -m 20 -w '%{http_code}' "$base$asset")" = 200 ] || { bad "asset $asset does not load"; missing=1; }
done < <({ curl -s -m 20 "$base/"; curl -s -m 20 "$base/shop"; } | grep -o '/_next/static/[^"]*\.\(js\|css\|woff2\)' | sort -u)
[ "$checked" -gt 0 ] || bad "found no static assets in the home and shop pages"
[ "$missing" = 0 ] && [ "$checked" -gt 0 ] && ok "all $checked static assets referenced by / and /shop load"

# A real product page: server-rendered h1 and Product JSON-LD.
slug="$(curl -s -m 20 "$base/api/products?pageSize=1" | sed -n 's/.*"slug":"\([^"]*\)".*/\1/p' | head -1)"
if [ -n "$slug" ]; then
  expect "/p/$slug" 200
  html="$(curl -s -m 20 "$base/p/$slug")"
  grep -q '"@type":"Product"' <<<"$html" && ok "product page carries Product JSON-LD" || bad "product page has no Product JSON-LD"
  grep -q '<h1' <<<"$html" && ok "product page has a server-rendered h1" || bad "product page has no h1"
else
  bad "no product slug from /api/products"
fi

# Headers: present, each exactly once (a duplicate or conflict means two layers both set it).
headers="$(curl -sI -m 20 "$base/")"
for h in content-security-policy strict-transport-security x-content-type-options referrer-policy x-frame-options; do
  n="$(grep -ci "^$h:" <<<"$headers")"
  case "$h" in
    content-security-policy) [ "$n" = 1 ] && ok "$h present once" || bad "$h appears $n times" ;;
    *) [ "$n" -ge 1 ] && { [ "$(grep -i "^$h:" <<<"$headers" | tr -d '\r' | sort -u | wc -l | tr -d ' ')" = 1 ] && ok "$h present, consistent" || bad "$h set twice with different values"; } || bad "$h missing" ;;
  esac
done
grep -qi '^x-powered-by' <<<"$headers" && bad "x-powered-by is exposed" || ok "no x-powered-by"

exit "$fail"
