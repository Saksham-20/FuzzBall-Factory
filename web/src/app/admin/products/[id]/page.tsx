import type { Metadata } from "next";
import { ProductEditorLoader } from "@/components/admin/products/ProductEditor";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <ProductEditorLoader id={id} />;
}
