import { AdminPage } from "@/components/admin/ui";
import { Skeleton } from "@/components/ui/misc";

/** Suspense fallback while the search params resolve, and the loading shape for the list. */
export function OrdersSkeleton() {
  return (
    <AdminPage title="Orders">
      <Skeleton className="h-12 w-full max-w-sm" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-11 w-28 shrink-0 rounded-full" />
        ))}
      </div>
      <OrderRowsSkeleton />
    </AdminPage>
  );
}

export function OrderRowsSkeleton() {
  return (
    <div role="status" aria-label="Loading orders" className="space-y-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-[92px] w-full rounded-ticket md:h-[72px]" />
      ))}
    </div>
  );
}
