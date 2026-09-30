import type { NextFunction, Request, Response } from 'express';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** `https://a.com, https://b.com/` -> `['https://a.com', 'https://b.com']`, the same normalisation CORS uses. */
export function parseOrigins(list: string): string[] {
  return list
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/**
 * Cross-site request forgery guard for cookie-authenticated writes. A browser always tells us where a state-changing
 * request came from (`Origin`); if it names anyone but our own storefront the request is refused, even before the
 * SameSite=Lax cookie rules or CORS would matter. Requests with no Origin (server-to-server: the Razorpay webhook,
 * curl, health checks) are not browser-driven and pass; reads are never checked.
 */
export function originCheck(allowed: readonly string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (!MUTATING.has(req.method) || origin === undefined) return next();
    if (allowed.includes(origin)) return next();
    res.status(403).json({ code: 'FORBIDDEN', message: "That request didn't come from our website." });
  };
}
