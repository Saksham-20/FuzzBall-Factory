import type { Metadata } from "next";
import { EmailsClient } from "@/components/admin/ops/EmailsClient";

export const metadata: Metadata = { title: "Emails" };

export default function AdminEmailsPage() {
  return <EmailsClient />;
}
