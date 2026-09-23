import { Suspense } from "react";
import type { Metadata } from "next";
import { ShopClient, ShopFallback } from "@/components/shop/ShopClient";

export const metadata: Metadata = {
  title: "The shelf",
  description:
    "Handmade crochet plushies, bouquets, keychains, wearables and gifts. Ready to ship or made to order, crocheted by hand in India.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage() {
  return (
    <Suspense fallback={<ShopFallback />}>
      <ShopClient />
    </Suspense>
  );
}
