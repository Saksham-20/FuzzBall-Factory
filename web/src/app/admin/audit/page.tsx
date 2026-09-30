import type { Metadata } from "next";
import { AuditClient } from "@/components/admin/ops/AuditClient";

export const metadata: Metadata = { title: "Audit log" };

export default function AdminAuditPage() {
  return <AuditClient />;
}
