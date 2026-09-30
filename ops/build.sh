#!/usr/bin/env bash
# Builds a deployable release on a clean Linux machine (CI). Nothing is built on the server.
#
#   ops/build.sh <release-id>            release id = the git sha
#
# Needs, as environment variables (the storefront bakes NEXT_PUBLIC_* in at build time; a production build refuses
# to run with the demo mode or localhost addresses, see web/src/lib/build-env.ts):
#   NEXT_PUBLIC_USE_MOCK=false  NEXT_PUBLIC_API_URL=https://<domain>/api  NEXT_PUBLIC_SITE_URL=https://<domain>
#   NEXT_PUBLIC_WHATSAPP=<digits>  [NEXT_PUBLIC_CLOUDINARY_CLOUD=<cloud>]  [LAUNCH_BUILD=true]
#
# Output: dist-release/fuzzball-<release-id>.tar.gz containing <release-id>/{api,web,activate.sh,RELEASE.env}.
# The API's production node_modules are installed here, on the same OS and CPU as the server, so the server
# needs no npm and no network to run a release (argon2 and sharp arrive as prebuilt binaries).
set -euo pipefail

release="${1:?usage: ops/build.sh <release-id>}"
[[ "$release" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "bad release id" >&2; exit 2; }
root="$(cd "$(dirname "$0")/.." && pwd)"
out="$root/dist-release"
stage="$out/stage/$release"

rm -rf "$out/stage" "$out/fuzzball-$release.tar.gz"
mkdir -p "$stage/api" "$stage/web"

echo "== api =="
cd "$root/api"
npm ci
npm run build
cp -R dist package.json package-lock.json "$stage/api/"
mkdir -p "$stage/api/scripts"
cp scripts/postinstall.mjs "$stage/api/scripts/"
(cd "$stage/api" && npm ci --omit=dev)

echo "== web =="
cd "$root/web"
npm ci
NEXT_OUTPUT=standalone npx next build
cp -R .next/standalone/. "$stage/web/"
mkdir -p "$stage/web/.next"
cp -R .next/static "$stage/web/.next/static"
cp -R public "$stage/web/public"
rm -rf "$stage/web/.next/cache"   # the server keeps its own, shared between releases

echo "== package =="
cp "$root/ops/server/activate.sh" "$stage/activate.sh"
chmod +x "$stage/activate.sh"
printf 'SENTRY_RELEASE=%s\n' "$release" > "$stage/RELEASE.env"
tar -C "$out/stage" -czf "$out/fuzzball-$release.tar.gz" "$release"
ls -lh "$out/fuzzball-$release.tar.gz"
