import { SITE } from "@/lib/site";

// Read here, not from the API client: the last-resort error screen must not pull the whole client in with it.
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

/**
 * Tells the API a visitor hit the error screen, so it reaches Sentry beside the API's own errors (no browser SDK, no
 * stack or page content leaves the device: only the message, Next's digest and the path without its query string).
 * Best effort and silent: a failing report must never make the error screen worse. Mock mode has no API to tell.
 */
export function reportClientError(error: Error & { digest?: string }, kind: "render" | "global"): void {
  if (SITE.useMock || typeof window === "undefined") return;
  try {
    void fetch(`${API_URL}/client-errors`, {
      method: "POST",
      keepalive: true,
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: (error.message || "Unknown error").slice(0, 300),
        ...(error.digest ? { digest: error.digest.slice(0, 64) } : {}),
        path: window.location.pathname.slice(0, 200),
        kind,
      }),
    }).catch(() => undefined);
  } catch {
    /* ignore */
  }
}
