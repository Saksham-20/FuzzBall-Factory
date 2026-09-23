import type { NextConfig } from "next";

// Images uploaded through the real API (POST /uploads) are served from the API origin (local disk driver) or Cloudinary.
const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const api = apiUrl ? new URL(apiUrl) : null;
const local = !!api && ["localhost", "127.0.0.1"].includes(api.hostname);

const nextConfig: NextConfig = {
  // Lets a second build (e.g. the real-API smoke build) live beside the default one: NEXT_DIST_DIR=.next-real npm run build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Self-contained server bundle for VPS deploys: NEXT_OUTPUT=standalone npm run build
  ...(process.env.NEXT_OUTPUT === "standalone" ? { output: "standalone" as const } : {}),
  images: {
    remotePatterns: [
      ...(api ? [{ protocol: api.protocol.replace(":", "") as "http" | "https", hostname: api.hostname, port: api.port }] : []),
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
    // Next refuses to optimise images from a loopback host unless told otherwise; only do it for a local dev API.
    ...(local ? { dangerouslyAllowLocalIP: true } : {}),
  },
};

export default nextConfig;
