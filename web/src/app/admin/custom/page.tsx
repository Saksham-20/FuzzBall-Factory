import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomClient } from "@/components/admin/custom/CustomClient";
import { CustomSkeleton } from "@/components/admin/custom/CustomSkeleton";

export const metadata: Metadata = { title: "Work orders" };

export default function AdminCustomPage() {
  return (
    <Suspense fallback={<CustomSkeleton />}>
      <CustomClient />
    </Suspense>
  );
}
