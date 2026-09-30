import type { Metadata } from "next";
import { OrderClient } from "@/components/checkout/OrderClient";
import { routeParam } from "@/lib/route-param";
import { first } from "@/lib/search-params";

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false },
};

export default async function OrderPage(props: { params: Promise<{ number: string }>; searchParams: Promise<{ new?: string | string[]; confirming?: string | string[] }> }) {
  const { number } = await props.params;
  const sp = await props.searchParams;
  const isNew = first(sp.new) === "1";
  const confirming = first(sp.confirming) === "1";
  return <OrderClient number={routeParam(number)} isNew={isNew} confirming={confirming} />;
}
