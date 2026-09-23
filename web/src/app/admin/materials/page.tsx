import type { Metadata } from "next";
import { MaterialsClient } from "@/components/admin/materials/MaterialsClient";

export const metadata: Metadata = { title: "Materials" };

export default function AdminMaterialsPage() {
  return <MaterialsClient />;
}
