import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopClient, ShopFallback } from "@/components/shop/ShopClient";
import { serverCategories, serverCategory, serverProducts } from "@/lib/catalog-server";
import { paletteOf } from "@/lib/palette";
import { JsonLd, breadcrumbLd } from "@/lib/json-ld";

type Props = { params: Promise<{ category: string }> };

export async function generateStaticParams() {
  return (await serverCategories()).map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const c = await serverCategory(category);
  if (!c) return { title: "Shelf not found" };
  const n = (await serverProducts({ category: c.slug })).length;
  return {
    title: c.name,
    description: `${c.name} from FuzzBall Factory: ${c.blurb.toLowerCase()}. ${n} handmade ${n === 1 ? "piece" : "pieces"}, ready to ship or made to order.`,
    alternates: { canonical: `/shop/${c.slug}` },
    openGraph: { title: `${c.name} · FuzzBall Factory`, images: [{ url: c.image, alt: c.name }] },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const c = await serverCategory(category);
  // An unknown shelf is a real 404 (status code and all), so search engines drop the URL.
  if (!c) notFound();
  const palette = paletteOf(await serverProducts({ category: c.slug }));
  return (
    <>
      <JsonLd
        data={breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: c.name, path: `/shop/${c.slug}` },
        ])}
      />
      <Suspense fallback={<ShopFallback category={c} />}>
        <ShopClient category={c} palette={palette} />
      </Suspense>
    </>
  );
}
