import type { Metadata } from "next";
import { WorkOrderDetail } from "@/components/account/custom/WorkOrderDetail";

type Props = { params: Promise<{ wo: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { wo } = await props.params;
  return { title: `Work order ${decodeURIComponent(wo).toUpperCase()}`, robots: { index: false } };
}

export default async function WorkOrderPage(props: Props) {
  const { wo } = await props.params;
  return <WorkOrderDetail number={decodeURIComponent(wo).toUpperCase()} />;
}
