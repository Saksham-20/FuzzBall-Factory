import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private or per-visitor pages. Each also carries a noindex tag; the rule here saves crawl budget.
      disallow: ["/admin", "/account", "/cart", "/wishlist", "/checkout", "/order", "/track", "/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/custom/sent", "/support/ticket", "/api"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
