import { Suspense } from "react";
import type { Metadata } from "next";
import { ShopClient, ShopFallback } from "@/components/shop/ShopClient";
import { serverProducts } from "@/lib/catalog-server";
import { paletteOf } from "@/lib/palette";

export const metadata: Metadata = {
  title: "The shelf",
  description:
    "Handmade crochet plushies, bouquets, keychains, wearables and gifts. Ready to ship or made to order, crocheted by hand in India.",
  alternates: { canonical: "/shop" },
};

export default async function ShopPage() {
  const palette = paletteOf(await serverProducts());
  return (
    <Suspense fallback={<ShopFallback />}>
      <ShopClient palette={palette} />
    </Suspense>
  );
}
