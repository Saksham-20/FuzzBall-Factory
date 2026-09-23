import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopClient, ShopFallback } from "@/components/shop/ShopClient";
import { categories, getCategory, productsIn } from "@/lib/mock/catalog";

type Props = { params: Promise<{ category: string }> };

// The mock database lives in the browser, so the server uses the seed catalogue for routing and metadata.
export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const c = getCategory(category);
  if (!c) return { title: "Shelf not found" };
  const n = productsIn(c.slug).length;
  return {
    title: c.name,
    description: `${c.name} from FuzzBall Factory: ${c.blurb.toLowerCase()}. ${n} handmade ${n === 1 ? "piece" : "pieces"}, ready to ship or made to order.`,
    alternates: { canonical: `/shop/${c.slug}` },
    openGraph: { title: `${c.name} · FuzzBall Factory`, images: [{ url: c.image, alt: c.name }] },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const c = getCategory(category);
  if (!c) notFound();
  return (
    <Suspense fallback={<ShopFallback category={c} />}>
      <ShopClient category={c} />
    </Suspense>
  );
}
