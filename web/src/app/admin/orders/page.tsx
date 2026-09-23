import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersClient } from "@/components/admin/orders/OrdersClient";
import { OrdersSkeleton } from "@/components/admin/orders/OrdersSkeleton";

export const metadata: Metadata = { title: "Orders" };

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersClient />
    </Suspense>
  );
}
