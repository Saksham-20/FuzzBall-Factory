import type { Metadata } from "next";
import { OrderDetailClient } from "@/components/account/OrderDetailClient";

export async function generateMetadata(props: { params: Promise<{ number: string }> }): Promise<Metadata> {
  const { number } = await props.params;
  return { title: `Order ${decodeURIComponent(number)}` };
}

export default async function OrderDetailPage(props: { params: Promise<{ number: string }> }) {
  const { number } = await props.params;
  return <OrderDetailClient number={decodeURIComponent(number)} />;
}
