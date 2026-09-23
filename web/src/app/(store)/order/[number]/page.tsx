import type { Metadata } from "next";
import { OrderClient } from "@/components/checkout/OrderClient";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false },
};

export default async function OrderPage(props: { params: Promise<{ number: string }>; searchParams: Promise<{ new?: string | string[] }> }) {
  const { number } = await props.params;
  const sp = await props.searchParams;
  const isNew = (Array.isArray(sp.new) ? sp.new[0] : sp.new) === "1";
  return <OrderClient number={decodeURIComponent(number)} isNew={isNew} />;
}
