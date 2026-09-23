"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { LayoutList, Rows3, Search } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { EmptyState, ErrorNote } from "@/components/ui/misc";
import { listAdminCustom } from "@/lib/api/admin";
import { useApi } from "@/lib/api/useApi";
import { cn } from "@/lib/cn";
import { CustomBoard } from "./CustomBoard";
import { CustomList } from "./CustomList";
import { BoardSkeleton, ListSkeleton } from "./CustomSkeleton";
import { matchesSearch } from "./workflow";

export function CustomClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = params.get("view") === "list" ? "list" : "board";
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useApi(() => listAdminCustom(), "custom:all");
  const rows = useMemo(() => data?.filter((r) => matchesSearch(r, q.trim())), [data, q]);

  const setView = (v: "board" | "list") => router.replace(v === "board" ? pathname : `${pathname}?view=list`, { scroll: false });

  const toggle = (v: "board" | "list", label: string, Icon: typeof Rows3) => (
    <button
      type="button"
      aria-pressed={view === v}
      onClick={() => setView(v)}
      className={cn(
        "press inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors duration-150",
        view === v ? "bg-cocoa text-cream" : "text-brown [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/8",
      )}
    >
      <Icon className="size-[18px]" strokeWidth={1.8} /> {label}
    </button>
  );

  return (
    <AdminPage title="Work orders">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-md">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-brown-soft" strokeWidth={1.8} />
          <Input type="search" aria-label="Search work orders by number, customer or title" placeholder="Search number, customer or title" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11" />
        </div>
        <div role="group" aria-label="View" className="flex gap-1">
          {toggle("board", "Board", Rows3)}
          {toggle("list", "List", LayoutList)}
        </div>
      </div>

      <div aria-busy={loading}>
        {error && !data ? (
          <ErrorNote onRetry={reload}>{error.message || "We couldn't load work orders."}</ErrorNote>
        ) : !rows ? (
          view === "board" ? <BoardSkeleton /> : <ListSkeleton />
        ) : data && data.length === 0 ? (
          <Panel><EmptyState title="No work orders yet">When someone sends a custom request, it lands in New.</EmptyState></Panel>
        ) : rows.length === 0 ? (
          <Panel>
            <EmptyState title="Nothing matches" action={<Button variant="secondary" onClick={() => setQ("")}>Clear search</Button>}>
              No work order matches “{q.trim()}”. Try a WO number, a customer name or a word from the title.
            </EmptyState>
          </Panel>
        ) : view === "board" ? (
          <CustomBoard rows={rows} />
        ) : (
          <CustomList rows={rows} />
        )}
      </div>
    </AdminPage>
  );
}
