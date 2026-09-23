import type { Metadata } from "next";
import { ProductEditorLoader } from "@/components/admin/products/ProductEditor";

export const metadata: Metadata = { title: "New product" };

export default function NewProductPage() {
  return <ProductEditorLoader />;
}
