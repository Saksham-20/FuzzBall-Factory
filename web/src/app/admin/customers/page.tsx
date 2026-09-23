import type { Metadata } from "next";
import { CustomersClient } from "@/components/admin/catalogue/CustomersClient";

export const metadata: Metadata = { title: "Customers" };

export default function AdminCustomersPage() {
  return <CustomersClient />;
}
