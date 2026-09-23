import type { Metadata } from "next";
import { CategoriesClient } from "@/components/admin/catalogue/CategoriesClient";

export const metadata: Metadata = { title: "Categories" };

export default function AdminCategoriesPage() {
  return <CategoriesClient />;
}
