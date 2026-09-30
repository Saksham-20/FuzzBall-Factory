import { describe, expect, it } from "vitest";
import { googleFeed } from "./google-feed";
import type { Category, Product } from "./types";

const product = (over: Partial<Product> = {}): Product =>
  ({
    id: "p1",
    slug: "pearl-bunny",
    name: "Pearl & \"Bunny\" <3",
    tagline: "Soft",
    description: "A bunny. Made with <love>.",
    category: "plushies",
    price: 499,
    fulfilment: "READY",
    leadTimeDays: 0,
    fiber: "cotton",
    images: [
      { src: "/a.jpg", alt: "a" },
      { src: "https://res.cloudinary.com/x/b.jpg", alt: "b" },
    ],
    variants: [{ id: "v1", stock: 2 }],
    status: "PUBLISHED",
    ...over,
  }) as unknown as Product;

const categories = [{ slug: "plushies", name: "Plushies" }] as unknown as Category[];
const feed = (products: Product[]) => googleFeed({ siteUrl: "https://fuzzballfactory.example/", siteName: "FuzzBall Factory", products, categories });

describe("google feed", () => {
  it("lists a published product with absolute links and INR prices", () => {
    const xml = feed([product()]);
    expect(xml).toContain("<g:id>pearl-bunny</g:id>");
    expect(xml).toContain("<link>https://fuzzballfactory.example/p/pearl-bunny</link>");
    expect(xml).toContain("<g:image_link>https://fuzzballfactory.example/a.jpg</g:image_link>");
    expect(xml).toContain("<g:additional_image_link>https://res.cloudinary.com/x/b.jpg</g:additional_image_link>");
    expect(xml).toContain("<g:price>499.00 INR</g:price>");
    expect(xml).toContain("<g:availability>in_stock</g:availability>");
    expect(xml).toContain("<g:product_type>Plushies</g:product_type>");
  });

  it("escapes markup in catalogue copy", () => {
    const xml = feed([product()]);
    expect(xml).toContain("<title>Pearl &amp; &quot;Bunny&quot; &lt;3</title>");
    expect(xml).toContain("Made with &lt;love&gt;.");
    expect(xml).not.toContain("<love>");
  });

  it("marks sold-out pieces out_of_stock", () => {
    expect(feed([product({ variants: [{ id: "v1", stock: 0 }] as Product["variants"] })])).toContain("out_of_stock");
  });

  it("uses the higher price as price and the real one as sale_price", () => {
    const xml = feed([product({ compareAtPrice: 699 })]);
    expect(xml).toContain("<g:price>699.00 INR</g:price>");
    expect(xml).toContain("<g:sale_price>499.00 INR</g:sale_price>");
  });

  it("skips drafts, sample data and pieces without a photo", () => {
    const xml = feed([product({ status: "DRAFT" as Product["status"] }), product({ sample: true }), product({ images: [] })]);
    expect(xml).not.toContain("<item>");
  });

  it("drops control characters that would break the XML", () => {
    expect(feed([product({ description: "a\u0001b" })])).toContain("<description>ab</description>");
  });
});
