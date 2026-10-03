import type { MetadataRoute } from "next";
import { LEGAL_UPDATED } from "@/components/content/meta";
import { POLICY_SLUGS } from "@/components/content/policies";
import { serverActiveCategories, serverProducts } from "@/lib/catalog-server";
import { SITE } from "@/lib/site";

// Product and category URLs come from the catalogue (the API in real mode, the seed data in mock mode). Rebuilt at
// most every few minutes; a product's lastmod is when the maker last changed it.
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([serverActiveCategories(), serverProducts()]);
  const base = SITE.url.replace(/\/$/, "");
  const now = new Date();
  const legalDate = new Date(`${LEGAL_UPDATED}T12:00:00+05:30`);

  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/shop`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/custom`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/drops`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
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
      lastModified: p.updatedAt ? new Date(p.updatedAt) : now,
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  return [...pages, ...categoryPages, ...productPages];
}
