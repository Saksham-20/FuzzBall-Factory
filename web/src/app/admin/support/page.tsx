import type { Metadata } from "next";
import { SupportListClient } from "@/components/admin/support/SupportListClient";

export const metadata: Metadata = { title: "Support" };

export default function AdminSupportPage() {
  return <SupportListClient />;
}
