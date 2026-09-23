import type { Metadata } from "next";
import { OrderDetailClient } from "@/components/admin/orders/OrderDetailClient";

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { number } = await props.params;
  return { title: `Order ${decodeURIComponent(number)}` };
}

export default async function AdminOrderPage(props: Props) {
  const { number } = await props.params;
  return <OrderDetailClient number={decodeURIComponent(number)} />;
}
