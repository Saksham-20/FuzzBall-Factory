import type { Metadata } from "next";
import { SentClient } from "@/components/custom/SentClient";
import { routeParam } from "@/lib/route-param";

export const metadata: Metadata = {
  title: "Work order received",
  robots: { index: false },
};

export default async function SentPage(props: { params: Promise<{ wo: string }> }) {
  const { wo } = await props.params;
  return <SentClient wo={routeParam(wo)} />;
}
