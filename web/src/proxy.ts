import { NextResponse, type NextRequest } from "next/server";

function decodesCleanly(pathname: string): boolean {
  try {
    decodeURIComponent(pathname);
    return true;
  } catch {
    return false;
  }
}

/**
 * Optimistic redirect only: `fbf_role` is a readable HINT cookie set by the client after login, signup or /auth/me
 * (mock or real API alike). The httpOnly API cookies are the session and the API enforces every role check,
 * so a forged hint only shows an empty admin shell. Never rely on this for security.
 */
export function proxy(req: NextRequest) {
  const role = req.cookies.get("fbf_role")?.value;
  const { pathname } = req.nextUrl;
  // Next answers a malformed percent-encoding in a dynamic segment (`/order/%`) with a bare 500 before any page
  // code runs. Send it to a path that matches nothing, so the visitor gets the branded 404 instead.
  if (!decodesCleanly(pathname)) return NextResponse.rewrite(new URL("/not-found-malformed-url", req.url));
  if (pathname.startsWith("/admin") && role !== "admin") {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/account") && !role) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

// Every page route, but not Next's own assets or files with an extension.
export const config = { matcher: ["/((?!_next/|api/|.*\\..*).*)"] };
