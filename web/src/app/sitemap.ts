import type { MetadataRoute } from "next";
import { LEGAL_UPDATED } from "@/components/content/meta";
import { POLICY_SLUGS } from "@/components/content/policies";
import { categories, products } from "@/lib/mock/catalog";
import { SITE } from "@/lib/site";

// PLACEHOLDER(catalogue): product and category URLs come from the seed catalogue. When the real API
// exists, fetch published products and categories here instead.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, "");
  const now = new Date();
  const legalDate = new Date(`${LEGAL_UPDATED}T12:00:00+05:30`);

  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/custom`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/drops`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/track`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/about`, lastModified: legalDate, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/contact`, lastModified: legalDate, changeFrequency: "yearly", priority: 0.6 },
    { url: `${base}/faq`, lastModified: legalDate, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/size-guide`, lastModified: legalDate, changeFrequency: "yearly", priority: 0.4 },
    { url: `${base}/care-guide`, lastModified: legalDate, changeFrequency: "yearly", priority: 0.4 },
    ...POLICY_SLUGS.map((slug) => ({
      url: `${base}/policies/${slug}`,
      lastModified: legalDate,
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];

  const categoryPages: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${base}/shop/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const productPages: MetadataRoute.Sitemap = products
    .filter((p) => p.status === "PUBLISHED")
    .map((p) => ({
      url: `${base}/p/${p.slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  return [...pages, ...categoryPages, ...productPages];
}
