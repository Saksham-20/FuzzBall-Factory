import type { Metadata } from "next";
import { OverviewClient } from "@/components/account/OverviewClient";

export const metadata: Metadata = { title: "Overview" };

export default function AccountPage() {
  return <OverviewClient />;
}
