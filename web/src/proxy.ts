import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic redirect only: `fbf_role` is a readable HINT cookie set by the client after login, signup or /auth/me
 * (mock or real API alike). The httpOnly API cookies are the session and the API enforces every role check,
 * so a forged hint only shows an empty admin shell. Never rely on this for security.
 */
export function proxy(req: NextRequest) {
  const role = req.cookies.get("fbf_role")?.value;
  const { pathname } = req.nextUrl;
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

export const config = { matcher: ["/admin/:path*", "/account/:path*"] };
