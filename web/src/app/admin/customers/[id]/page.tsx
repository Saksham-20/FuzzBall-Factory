import type { Metadata } from "next";
import { CustomerDetailClient } from "@/components/admin/catalogue/CustomerDetailClient";

export const metadata: Metadata = { title: "Customer" };

export default async function AdminCustomerPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <CustomerDetailClient id={id} />;
}
