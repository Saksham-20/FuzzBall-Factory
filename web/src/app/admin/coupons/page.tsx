import type { Metadata } from "next";
import { CouponsClient } from "@/components/admin/catalogue/CouponsClient";

export const metadata: Metadata = { title: "Coupons" };

export default function AdminCouponsPage() {
  return <CouponsClient />;
}
