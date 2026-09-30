/**
 * Checks the NEXT_PUBLIC_* values a production build inlines, so a forgotten variable stops the build instead of
 * quietly shipping the demo storefront (mock mode, seeded logins in the bundle) or localhost links (canonicals,
 * sitemap, share images). Pure so it can be unit tested; next.config.ts runs it for `next build` only.
 *
 * Three tiers: any production build must choose its mode; a real-API build must point at real public URLs; a launch
 * build (`LAUNCH_BUILD=true`, build-time only, not NEXT_PUBLIC) must also have no placeholder contact details left.
 */
export const PLACEHOLDER_WHATSAPP = "910000000000";

const isLocalHost = (host: string) => ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(host);

function urlProblem(name: string, value: string | undefined): string | null {
  if (!value) return `${name} is not set`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `${name} is not an absolute URL (got "${value}")`;
  }
  if (isLocalHost(url.hostname)) return `${name} points at ${url.hostname}; use the real public address`;
  return null;
}

export function buildEnvProblems(env: Record<string, string | undefined>): string[] {
  const mode = env.NEXT_PUBLIC_USE_MOCK;
  if (mode !== "true" && mode !== "false") {
    return [
      'NEXT_PUBLIC_USE_MOCK must be set explicitly for a production build: "true" = demo storefront on browser-only sample data, "false" = the real API.',
    ];
  }
  // Demo builds (test server, CI) may keep the sample values; the real storefront may not.
  if (mode === "true") return [];

  const problems = [urlProblem("NEXT_PUBLIC_API_URL", env.NEXT_PUBLIC_API_URL), urlProblem("NEXT_PUBLIC_SITE_URL", env.NEXT_PUBLIC_SITE_URL)];
  if (env.LAUNCH_BUILD !== "true") return problems.filter((p): p is string => p !== null);

  const whatsapp = env.NEXT_PUBLIC_WHATSAPP;
  if (!whatsapp) problems.push("NEXT_PUBLIC_WHATSAPP is not set");
  else if (whatsapp === PLACEHOLDER_WHATSAPP) problems.push(`NEXT_PUBLIC_WHATSAPP is still the placeholder ${PLACEHOLDER_WHATSAPP}`);
  else if (!/^\d{8,15}$/.test(whatsapp)) problems.push("NEXT_PUBLIC_WHATSAPP must be digits only with the country code (8 to 15 digits)");
  return problems.filter((p): p is string => p !== null);
}

/** Throws one readable error listing every problem. */
export function assertBuildEnv(env: Record<string, string | undefined>): void {
  const problems = buildEnvProblems(env);
  if (problems.length) throw new Error(`Refusing to build: unsafe production environment.\n${problems.map((p) => `  - ${p}`).join("\n")}`);
}
