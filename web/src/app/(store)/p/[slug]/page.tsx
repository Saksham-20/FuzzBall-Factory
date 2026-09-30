import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductView } from "@/components/shop/ProductView";
import { serverProduct, serverProducts } from "@/lib/catalog-server";
import { SITE } from "@/lib/site";
import type { Product } from "@/lib/types";

type Props = { params: Promise<{ slug: string }> };

// Pieces that exist at build time are prerendered; new ones render on first visit and are cached (see catalog-server).
export async function generateStaticParams() {
  return (await serverProducts()).map((p) => ({ slug: p.slug }));
}

const abs = (path: string) => new URL(path, SITE.url).toString();

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await serverProduct(slug).catch(() => null);
  if (!p) return { title: "A FuzzBall piece" };
  const lead = p.fulfilment === "READY" ? "Ready to ship." : `Made to order, ready in about ${p.leadTimeDays} days.`;
  const description = `${p.tagline}. ${lead} Handmade crochet from FuzzBall Factory, ₹${p.price.toLocaleString("en-IN")}.`;
  return {
    title: p.name,
    description,
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: { title: `${p.name} · ${SITE.name}`, description, type: "website", url: `/p/${p.slug}` },
    twitter: { card: "summary_large_image", title: p.name, description },
  };
}

function jsonLd(p: Product) {
  const soldOut = p.variants.every((v) => v.stock === 0);
  // No AggregateRating on purpose: there are no real reviews yet.
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    sku: p.slug,
    image: p.images.map((i) => abs(i.src)),
    brand: { "@type": "Brand", name: SITE.name },
    material: p.fiber,
    countryOfOrigin: "IN",
    offers: {
      "@type": "Offer",
      url: abs(`/p/${p.slug}`),
      priceCurrency: "INR",
      price: p.price,
      itemCondition: "https://schema.org/NewCondition",
      availability: soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  // Throws (error page) if the API is down: an outage must never look like "this piece doesn't exist".
  const product = await serverProduct(slug);
  // Real data: an unknown or unpublished slug is a real 404. Mock data lives in the browser (a piece the maker just
  // added there is not on the server), so the client resolves it and shows "This batch doesn't exist" itself.
  if (!product && !SITE.useMock) notFound();
  return (
    <>
      {product ? (
        <script
          type="application/ld+json"
          // Escape "<" so product copy can never close the script tag.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(product)).replace(/</g, "\\u003c") }}
        />
      ) : null}
      <ProductView key={slug} slug={slug} initial={product ?? undefined} />
    </>
  );
}
