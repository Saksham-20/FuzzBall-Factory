import type { Metadata } from "next";
import { CustomDetailClient } from "@/components/admin/custom/CustomDetailClient";

type Props = { params: Promise<{ wo: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { wo } = await props.params;
  return { title: `Work order ${decodeURIComponent(wo)}` };
}

export default async function AdminWorkOrderPage(props: Props) {
  const { wo } = await props.params;
  return <CustomDetailClient number={decodeURIComponent(wo)} />;
}
