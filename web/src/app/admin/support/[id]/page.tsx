import type { Metadata } from "next";
import { SupportDetailClient } from "@/components/admin/support/SupportDetailClient";
import { routeParam } from "@/lib/route-param";

export const metadata: Metadata = { title: "Support request" };

export default async function AdminSupportDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <SupportDetailClient id={routeParam(id)} />;
}
