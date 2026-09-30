const BASE = "https://same-site.invalid";

/**
 * Only same-site paths survive. Browsers strip tabs and newlines and treat `\` like `/` when they follow a URL, so a
 * startsWith check is not enough (`/\t/evil.com` becomes `//evil.com`). The value is rejected if it holds control
 * characters or backslashes, then parsed against a fake origin and accepted only if it stays on it; what comes back
 * is the parsed path, so nothing unparsed is ever used.
 */
export function safeNext(next?: string | null): string | undefined {
  if (!next || next.length > 2048) return undefined;
  if (!next.startsWith("/") || next.startsWith("//")) return undefined;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return undefined;
  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return undefined;
  }
  if (url.origin !== BASE) return undefined;
  return `${url.pathname}${url.search}${url.hash}`;
}
