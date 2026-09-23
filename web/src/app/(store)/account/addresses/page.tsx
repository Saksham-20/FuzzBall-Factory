import type { Metadata } from "next";
import { AddressesClient } from "@/components/account/AddressesClient";

export const metadata: Metadata = { title: "Addresses" };

export default function AddressesPage() {
  return <AddressesClient />;
}
