import { googleFeed } from "@/lib/google-feed";
import { serverCategories, serverProducts } from "@/lib/catalog-server";
import { SITE } from "@/lib/site";

// Merchant Center fetches this on a schedule; an hour-old copy is fine and keeps the API quiet.
export const revalidate = 3600;

export async function GET() {
  const [products, categories] = await Promise.all([serverProducts(), serverCategories()]);
  return new Response(googleFeed({ siteUrl: SITE.url, siteName: SITE.name, products, categories }), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
