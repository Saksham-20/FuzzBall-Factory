import type { Metadata } from "next";
import { HideWhatsApp } from "@/components/checkout/HideWhatsApp";
import { CheckoutClient } from "@/components/checkout/CheckoutClient";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Add your address, pick how to pay and place your order.",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <>
      <HideWhatsApp />
      <CheckoutClient />
    </>
  );
}
