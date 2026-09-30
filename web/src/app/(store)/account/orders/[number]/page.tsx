import type { Metadata } from "next";
import { OrderDetailClient } from "@/components/account/OrderDetailClient";
import { routeParam } from "@/lib/route-param";

export async function generateMetadata(props: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await props.params;
  return { title: `Order ${routeParam(number)}` };
}

export default async function OrderDetailPage(props: { params: Promise<{ number: string }> }) {
  const { number } = await props.params;
  return <OrderDetailClient number={routeParam(number)} />;
}
