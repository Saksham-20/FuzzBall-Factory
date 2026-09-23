import type { Metadata } from "next";
import { SettingsClient } from "@/components/admin/settings/SettingsClient";

export const metadata: Metadata = { title: "Settings" };

export default function AdminSettingsPage() {
  return <SettingsClient />;
}
