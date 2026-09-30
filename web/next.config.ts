import { join } from "node:path";
import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { assertBuildEnv } from "./src/lib/build-env";
import { assertNoPlaceholders } from "./src/lib/placeholders-scan";
import { securityHeaders } from "./src/lib/security-headers";

// Images uploaded through the real API (POST /uploads) are served from the API origin (local disk driver) or Cloudinary.
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const api = apiUrl ? new URL(apiUrl) : null;
const cloudinaryCloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD;
const local = !!api && ["localhost", "127.0.0.1"].includes(api.hostname);

// Real-API builds must not carry the sample database (seeded logins and passwords): swap it for a stub at bundle time.
const realApiBuild = process.env.NEXT_PUBLIC_USE_MOCK === "false";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Trace files from this folder, never a lockfile further up: the standalone server then sits at .next/standalone/server.js
  // on every machine (ops/build.sh relies on it).
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders({ apiOrigin: api?.origin, production: process.env.NODE_ENV === "production" }) }];
  },
  // Lets a second build (e.g. the real-API smoke build) live beside the default one: NEXT_DIST_DIR=.next-real npm run build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Self-contained server bundle for VPS deploys: NEXT_OUTPUT=standalone npm run build
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  ...(realApiBuild ? { turbopack: { resolveAlias: { "@/lib/mock/db": "./src/lib/mock/db.real.ts" } } } : {}),
  images: {
    // Cloudinary pictures are transformed by Cloudinary (see image-loader.ts); the rest go through Next's optimiser.
    loaderFile: "./src/lib/image-loader.ts",
    formats: ["image/avif", "image/webp"],
    // Optimised copies are kept a day, not a minute: the source images change rarely and re-encoding costs CPU.
    minimumCacheTTL: 86_400,
    remotePatterns: [
      ...(api ? [{ protocol: api.protocol.replace(":", "") as "http" | "https", hostname: api.hostname, port: api.port }] : []),
      // Only the maker's own cloud when its name is known (NEXT_PUBLIC_CLOUDINARY_CLOUD), so the optimiser cannot be
      // pointed at anyone else's account.
      { protocol: "https", hostname: "res.cloudinary.com", ...(cloudinaryCloud ? { pathname: `/${cloudinaryCloud}/**` } : {}) },
    ],
    // Next refuses to optimise images from a loopback host unless told otherwise; only do it for a local dev API.
    ...(local ? { dangerouslyAllowLocalIP: true } : {}),
  },
};

export default function config(phase: string): NextConfig {
  // Stop a production build that would ship the demo storefront or localhost links by accident (see build-env.ts).
  if (phase === PHASE_PRODUCTION_BUILD) {
    assertBuildEnv(process.env);
    // A launch build also refuses stand-in content that is still tagged (registry: docs/PLACEHOLDERS.md).
    if (process.env.LAUNCH_BUILD === "true") assertNoPlaceholders(join(process.cwd(), "src"), process.env.PLACEHOLDERS_ALLOWED);
  }
  return nextConfig;
}
