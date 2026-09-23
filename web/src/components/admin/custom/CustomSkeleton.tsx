import { AdminPage } from "@/components/admin/ui";
import { Skeleton } from "@/components/ui/misc";

export function CustomSkeleton() {
  return (
    <AdminPage title="Work orders">
      <Skeleton className="h-12 w-full max-w-sm" />
      <BoardSkeleton />
    </AdminPage>
  );
}

export function BoardSkeleton() {
  return (
    <div role="status" aria-label="Loading work orders" className="-mx-4 flex gap-4 overflow-hidden px-4 md:mx-0 md:px-0">
      {[3, 2, 1, 2, 3].map((n, c) => (
        <div key={c} className="w-[280px] shrink-0 space-y-3">
          <Skeleton className="h-9 w-full" />
          {Array.from({ length: n }, (_, i) => <Skeleton key={i} className="h-[132px] w-full rounded-ticket" />)}
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div role="status" aria-label="Loading work orders" className="space-y-3">
      {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[104px] w-full rounded-ticket md:h-[68px]" />)}
    </div>
  );
}
