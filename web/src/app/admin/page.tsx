import type { Metadata } from "next";
import { DashboardClient } from "@/components/admin/dashboard/DashboardClient";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return <DashboardClient />;
}
