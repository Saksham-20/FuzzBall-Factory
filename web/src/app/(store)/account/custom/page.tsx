import type { Metadata } from "next";
import { WorkOrderList } from "@/components/account/custom/WorkOrderList";

export const metadata: Metadata = {
  title: "Your work orders",
  description: "Quotes, deposits, progress photos and messages for your custom crochet work orders.",
  robots: { index: false },
};

export default function WorkOrdersPage() {
  return <WorkOrderList />;
}
