import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { assertBuildEnv } from "./src/lib/build-env";

// Images uploaded through the real API (POST /uploads) are served from the API origin (local disk driver) or Cloudinary.
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const api = apiUrl ? new URL(apiUrl) : null;
const local = !!api && ["localhost", "127.0.0.1"].includes(api.hostname);

// Real-API builds must not carry the sample database (seeded logins and passwords): swap it for a stub at bundle time.
const realApiBuild = process.env.NEXT_PUBLIC_USE_MOCK === "false";

const nextConfig: NextConfig = {
  // Lets a second build (e.g. the real-API smoke build) live beside the default one: NEXT_DIST_DIR=.next-real npm run build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Self-contained server bundle for VPS deploys: NEXT_OUTPUT=standalone npm run build
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  ...(realApiBuild ? { turbopack: { resolveAlias: { "@/lib/mock/db": "./src/lib/mock/db.real.ts" } } } : {}),
  images: {
    remotePatterns: [
      ...(api ? [{ protocol: api.protocol.replace(":", "") as "http" | "https", hostname: api.hostname, port: api.port }] : []),
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
    // Next refuses to optimise images from a loopback host unless told otherwise; only do it for a local dev API.
    ...(local ? { dangerouslyAllowLocalIP: true } : {}),
  },
};

export default function config(phase: string): NextConfig {
  // Stop a production build that would ship the demo storefront or localhost links by accident (see build-env.ts).
  if (phase === PHASE_PRODUCTION_BUILD) assertBuildEnv(process.env);
  return nextConfig;
}
