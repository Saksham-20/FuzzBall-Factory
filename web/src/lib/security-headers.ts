/**
 * Response headers for every page. Kept out of next.config.ts so a test can read the policy.
 *
 * Script policy: Next's own inline bootstrap scripts need `'unsafe-inline'` unless every page is rendered per
 * request with a nonce, and that would give up the cached catalogue pages. So scripts are limited to this site and
 * Razorpay's checkout script, and everything else is locked down hard (no plugins, no framing, no foreign forms,
 * no foreign base tag). The upgrade path (nonce from proxy.ts) is in TODOS.md.
 */

type Options = {
  /** Origin of the real API (NEXT_PUBLIC_API_URL), if the storefront talks to one. */
  apiOrigin?: string;
  production: boolean;
};

const RAZORPAY = "https://*.razorpay.com";

function uniq(values: (string | undefined)[]): string {
  return [...new Set(values.filter(Boolean))].join(" ");
}

export function contentSecurityPolicy({ apiOrigin }: Pick<Options, "apiOrigin">): string {
  const directives: Record<string, string> = {
    "default-src": "'self'",
    "script-src": uniq(["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"]),
    "style-src": "'self' 'unsafe-inline'",
    "img-src": uniq(["'self'", "data:", "blob:", "https://res.cloudinary.com", apiOrigin, RAZORPAY]),
    "font-src": "'self' data:",
    "connect-src": uniq(["'self'", apiOrigin, RAZORPAY]),
    "frame-src": RAZORPAY,
    "object-src": "'none'",
    "base-uri": "'self'",
    "form-action": "'self'",
    "frame-ancestors": "'none'",
  };
  return Object.entries(directives)
    .map(([name, value]) => `${name} ${value}`)
    .join("; ");
}

export function securityHeaders({ apiOrigin, production }: Options): { key: string; value: string }[] {
  const headers = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    // A password-reset token sits in the URL of one page: never hand it to another site as a referrer.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self), interest-cohort=()" },
  ];
  // Dev needs eval for hot reload and plain http; only a real deployment gets the strict pair.
  if (production) {
    headers.push(
      { key: "Content-Security-Policy", value: contentSecurityPolicy({ apiOrigin }) },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    );
  }
  return headers;
}
