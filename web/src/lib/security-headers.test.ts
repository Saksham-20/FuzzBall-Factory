import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const API = "https://api.fuzzballfactory.example";

describe("content security policy", () => {
  const csp = contentSecurityPolicy({ apiOrigin: API });
  const directive = (name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

  it("lets the storefront call its API and Razorpay, and nobody else", () => {
    expect(directive("connect-src")).toContain(API);
    expect(directive("connect-src")).toContain("https://*.razorpay.com");
    expect(directive("connect-src")).not.toContain("*.example");
  });

  it("loads scripts only from this site and the Razorpay checkout", () => {
    expect(directive("script-src")).toBe("script-src 'self' 'unsafe-inline' https://checkout.razorpay.com");
    expect(directive("script-src")).not.toContain("unsafe-eval");
  });

  it("frames Razorpay only, is never framed, and blocks plugins", () => {
    expect(directive("frame-src")).toBe("frame-src https://*.razorpay.com");
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
    expect(directive("form-action")).toBe("form-action 'self'");
  });

  it("allows Cloudinary and the API for images", () => {
    expect(directive("img-src")).toContain("https://res.cloudinary.com");
    expect(directive("img-src")).toContain(API);
  });

  it("works with no API origin (mock build)", () => {
    expect(contentSecurityPolicy({})).not.toContain("undefined");
  });
});

describe("security headers", () => {
  const names = (production: boolean) => securityHeaders({ apiOrigin: API, production }).map((h) => h.key);

  it("adds CSP and HSTS only in production", () => {
    expect(names(true)).toEqual(expect.arrayContaining(["Content-Security-Policy", "Strict-Transport-Security"]));
    expect(names(false)).not.toContain("Content-Security-Policy");
    expect(names(false)).not.toContain("Strict-Transport-Security");
  });

  it("always sends the basics", () => {
    expect(names(false)).toEqual(
      expect.arrayContaining(["X-Content-Type-Options", "X-Frame-Options", "Referrer-Policy", "Permissions-Policy"]),
    );
  });
});
