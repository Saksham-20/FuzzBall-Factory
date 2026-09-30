import type { Metadata } from "next";
import { WorkOrderDetail } from "@/components/account/custom/WorkOrderDetail";
import { routeParam } from "@/lib/route-param";

type Props = { params: Promise<{ wo: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { wo } = await props.params;
  return { title: `Work order ${routeParam(wo).toUpperCase()}`, robots: { index: false } };
}

export default async function WorkOrderPage(props: Props) {
  const { wo } = await props.params;
  return <WorkOrderDetail number={routeParam(wo).toUpperCase()} />;
}
