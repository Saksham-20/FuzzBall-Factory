"use client";

import Link from "next/link";
import { useState } from "react";
import { AdminPage, Panel, TableWrap, Td, Th } from "@/components/admin/ui";
import { ListSkeleton, SearchBox, useDebounced } from "@/components/admin/catalogue/kit";
import { EmptyState, ErrorNote } from "@/components/ui/misc";
import { useApi } from "@/lib/api/useApi";
import { listCustomers } from "@/lib/api/admin";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";

export function CustomersClient() {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim());
  const { data, error, loading, reload } = useApi(() => listCustomers(dq || undefined), `customers:${dq}`);

  return (
    <AdminPage title="Customers">
      <SearchBox label="Search by name or email" value={q} onChange={setQ} className="w-full md:max-w-sm" />
      {error ? (
        <ErrorNote onRetry={reload}>{error.message || "Customers didn't load."}</ErrorNote>
      ) : loading && !data ? (
        <ListSkeleton rows={6} />
      ) : !data || data.length === 0 ? (
        <Panel>
          <EmptyState title={dq ? "No customers match" : "No customers yet"}>
            {dq ? "Check the spelling, or search by email instead." : "People who sign up or check out with an account appear here."}
          </EmptyState>
        </Panel>
      ) : (
        <div aria-busy={loading} className={cn("transition-opacity duration-150", loading && "opacity-60")}>
          <ul className="space-y-3 md:hidden">
            {data.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/customers/${c.id}`} className="press block rounded-ticket bg-paper p-4 shadow-ticket">
                  <p className="font-semibold">{c.name}</p>
                  <p className="truncate text-sm text-brown">{c.email}</p>
                  <p className="tabular mt-2 text-sm">
                    {c.orders} {c.orders === 1 ? "order" : "orders"} · {c.workOrders} work {c.workOrders === 1 ? "order" : "orders"} · {formatINR(c.spent)} paid
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Panel flush>
              <TableWrap>
                <caption className="sr-only">Customers</caption>
                <thead>
                  <tr><Th>Name</Th><Th>Email</Th><Th>Phone</Th><Th className="text-right">Orders</Th><Th className="text-right">Work orders</Th><Th className="text-right">Paid</Th><Th>Joined</Th></tr>
                </thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.id}>
                      <Td><Link href={`/admin/customers/${c.id}`} className="font-semibold underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">{c.name}</Link></Td>
                      <Td className="text-brown">{c.email}</Td>
                      <Td className="tabular whitespace-nowrap">{c.phone ?? <span className="text-brown-soft">None</span>}</Td>
                      <Td className="tabular text-right">{c.orders}</Td>
                      <Td className="tabular text-right">{c.workOrders}</Td>
                      <Td className="tabular text-right whitespace-nowrap">{formatINR(c.spent)}</Td>
                      <Td className="whitespace-nowrap text-brown">{formatDate(c.createdAt, { day: "numeric", month: "short", year: "numeric" })}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Panel>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
