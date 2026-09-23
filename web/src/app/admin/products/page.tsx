import type { Metadata } from "next";
import { ProductsClient } from "@/components/admin/products/ProductsClient";

export const metadata: Metadata = { title: "Products" };

export default function AdminProductsPage() {
  return <ProductsClient />;
}
