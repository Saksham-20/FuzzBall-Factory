import type { Metadata } from "next";
import { PricingClient } from "@/components/admin/pricing/PricingClient";

export const metadata: Metadata = { title: "Price calculator" };

export default function AdminPricingPage() {
  return <PricingClient />;
}
