"use client";

import Link from "next/link";
import { ChevronLeft, Mail, MessageCircle } from "lucide-react";
import { AdminPage, Panel, TableWrap, Td, Th } from "@/components/admin/ui";
import { digits } from "@/components/admin/catalogue/kit";
import { Button } from "@/components/ui/Button";
import { CustomStamp, OrderStamp } from "@/components/ui/StatusStamp";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import { useApi } from "@/lib/api/useApi";
import { getCustomer } from "@/lib/api/admin";
import { formatDate, formatINR } from "@/lib/format";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-baseline justify-between gap-4 border-b border-line py-2.5">
      <dt className="text-brown">{label}</dt>
      <dd className="min-w-0 text-right font-semibold break-words">{children}</dd>
    </div>
  );
}

export function CustomerDetailClient({ id }: { id: string }) {
  const { data, error, loading, reload } = useApi(() => getCustomer(id), `customer:${id}`);
  const back = (
    <Link href="/admin/customers" className="press inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brown underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">
      <ChevronLeft className="size-4" strokeWidth={2} /> All customers
    </Link>
  );

  if (error) {
    const notFound = (error as { status?: number }).status === 404;
    return (
      <div className="space-y-4">
        {back}
        {notFound ? (
          <EmptyState title="Customer not found" action={<Button asChild><Link href="/admin/customers">Back to customers</Link></Button>}>They may have deleted their account.</EmptyState>
        ) : (
          <ErrorNote onRetry={reload}>{error.message || "This customer didn't load."}</ErrorNote>
        )}
      </div>
    );
  }
  if (loading || !data) {
    return (
      <div role="status" aria-label="Loading the customer" className="space-y-4">
        {back}
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const { user, orders, custom } = data;
  const paid = orders.filter((o) => o.paymentStatus === "PAID").reduce((s, o) => s + o.total, 0);
  const wa = user.phone && digits(user.phone) ? `https://wa.me/${digits(user.phone)}` : null;

  return (
    <div className="space-y-4">
      {back}
      <AdminPage
        title={user.name}
        actions={
          <>
            {wa ? <Button asChild variant="secondary"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle strokeWidth={1.8} /> WhatsApp {user.name.split(" ")[0]}</a></Button> : null}
            <Button asChild variant="secondary"><a href={`mailto:${user.email}`}><Mail strokeWidth={1.8} /> Email</a></Button>
          </>
        }
      >
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_1.6fr]">
          <Panel title="Contact">
            <dl>
              <Row label="Email">{user.email}</Row>
              <Row label="Phone">{user.phone ?? <span className="font-normal text-brown-soft">Not given</span>}</Row>
              <Row label="Joined">{formatDate(user.createdAt, { day: "numeric", month: "short", year: "numeric" })}</Row>
              <Row label="Orders"><span className="tabular">{orders.length}</span></Row>
              <Row label="Work orders"><span className="tabular">{custom.length}</span></Row>
              <Row label="Paid so far"><span className="tabular">{formatINR(paid)}</span></Row>
            </dl>
          </Panel>

          <div className="space-y-4">
            <Panel title="Orders" flush>
              {orders.length === 0 ? (
                <p className="px-5 pb-5 text-brown">No orders yet.</p>
              ) : (
                <TableWrap>
                  <caption className="sr-only">Orders</caption>
                  <thead><tr><Th>Order</Th><Th>Placed</Th><Th className="text-right">Total</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.number}>
                        <Td><Link href={`/admin/orders/${o.number}`} className="font-stencil text-[13px] underline underline-offset-4">{o.number}</Link></Td>
                        <Td className="whitespace-nowrap">{formatDate(o.createdAt)}</Td>
                        <Td className="tabular text-right whitespace-nowrap">{formatINR(o.total)}</Td>
                        <Td><OrderStamp status={o.status} className="scale-90" /></Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </Panel>

            <Panel title="Work orders" flush>
              {custom.length === 0 ? (
                <p className="px-5 pb-5 text-brown">No work orders yet.</p>
              ) : (
                <TableWrap>
                  <caption className="sr-only">Work orders</caption>
                  <thead><tr><Th>Work order</Th><Th>Idea</Th><Th>Budget</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {custom.map((r) => (
                      <tr key={r.number}>
                        <Td><Link href={`/admin/custom/${r.number}`} className="font-stencil text-[13px] underline underline-offset-4">{r.number}</Link></Td>
                        <Td>{r.title}</Td>
                        <Td className="tabular whitespace-nowrap">{formatINR(r.budgetMin)}–{formatINR(r.budgetMax)}</Td>
                        <Td><CustomStamp status={r.status} className="scale-90" /></Td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              )}
            </Panel>
          </div>
        </div>
      </AdminPage>
    </div>
  );
}
