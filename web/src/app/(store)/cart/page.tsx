import type { Metadata } from "next";
import { CartClient } from "@/components/checkout/CartClient";

export const metadata: Metadata = {
  title: "Your basket",
  description: "Review the pieces in your basket, add a discount code and check out.",
  robots: { index: false },
};

export default function CartPage() {
  return <CartClient />;
}
