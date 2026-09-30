import type { Metadata } from "next";
import { OrderDetailClient } from "@/components/admin/orders/OrderDetailClient";
import { routeParam } from "@/lib/route-param";

type Props = { params: Promise<{ number: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { number } = await props.params;
  return { title: `Order ${routeParam(number)}` };
}

export default async function AdminOrderPage(props: Props) {
  const { number } = await props.params;
  return <OrderDetailClient number={routeParam(number)} />;
}
