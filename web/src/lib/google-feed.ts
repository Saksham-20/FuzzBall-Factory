import type { Category, Product } from "@/lib/types";

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Characters XML 1.0 cannot carry at all (a stray control character would make the whole feed unreadable). */
const stripControl = (value: string) => value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");

const text = (value: string) => escapeXml(stripControl(value));

/** "499.00 INR" */
const money = (rupees: number) => `${rupees.toFixed(2)} INR`;

/**
 * Google Merchant Center product feed (RSS 2.0 with the g: namespace) for the published catalogue. Shipping and
 * returns are set in the Merchant Center account itself, not per item, so they are not repeated here. Handmade
 * pieces have no GTIN, hence `identifier_exists no`. Dev sample data is never listed.
 */
export function googleFeed(opts: { siteUrl: string; siteName: string; products: Product[]; categories: Category[] }): string {
  const base = opts.siteUrl.replace(/\/$/, "");
  const categoryName = new Map(opts.categories.map((c) => [c.slug, c.name]));
  const items = opts.products
    .filter((p) => p.status === "PUBLISHED" && !p.sample && p.images.length > 0)
    .map((p) => {
      const inStock = p.variants.some((v) => v.stock > 0);
      const [main, ...more] = p.images;
      return [
        "    <item>",
        `      <g:id>${text(p.slug)}</g:id>`,
        `      <title>${text(p.name)}</title>`,
        `      <description>${text(p.description || p.tagline)}</description>`,
        `      <link>${text(`${base}/p/${p.slug}`)}</link>`,
        `      <g:image_link>${text(new URL(main.src, base).toString())}</g:image_link>`,
        ...more.slice(0, 10).map((i) => `      <g:additional_image_link>${text(new URL(i.src, base).toString())}</g:additional_image_link>`),
        `      <g:availability>${inStock ? "in_stock" : "out_of_stock"}</g:availability>`,
        `      <g:price>${money(p.compareAtPrice && p.compareAtPrice > p.price ? p.compareAtPrice : p.price)}</g:price>`,
        ...(p.compareAtPrice && p.compareAtPrice > p.price ? [`      <g:sale_price>${money(p.price)}</g:sale_price>`] : []),
        "      <g:condition>new</g:condition>",
        `      <g:brand>${text(opts.siteName)}</g:brand>`,
        "      <g:identifier_exists>no</g:identifier_exists>",
        ...(categoryName.has(p.category) ? [`      <g:product_type>${text(categoryName.get(p.category) as string)}</g:product_type>`] : []),
        ...(p.fiber ? [`      <g:material>${text(p.fiber)}</g:material>`] : []),
        "    </item>",
      ].join("\n");
    });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "  <channel>",
    `    <title>${text(opts.siteName)}</title>`,
    `    <link>${text(base)}</link>`,
    "    <description>Handmade crochet, ready to ship or made to order.</description>",
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}
