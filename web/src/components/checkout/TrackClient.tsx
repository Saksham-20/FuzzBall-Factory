"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessageCircle, PackageSearch } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { Stamp } from "@/components/brand/Stamp";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { ErrorNote, PageHeader, Skeleton } from "@/components/ui/misc";
import { OrderTimeline } from "@/components/checkout/OrderTimeline";
import { trackOrder } from "@/lib/api/orders";
import { useApi } from "@/lib/api/useApi";
import { trackSchema, type TrackValues } from "@/lib/schemas/track";
import { ORDER_STATUS } from "@/lib/status";
import { formatDate } from "@/lib/format";
import { waOrder } from "@/lib/whatsapp";

interface Query {
  number: string;
  contact: string;
  /** Bumped on every submit so the same lookup can be repeated. */
  n: number;
}

export function TrackClient({ initialOrder = "", initialContact = "" }: { initialOrder?: string; initialContact?: string }) {
  // The landing-page form links here with ?order=&phone=, so a full pair looks itself up.
  const [query, setQuery] = useState<Query | null>(
    initialOrder.trim() && initialContact.trim() ? { number: initialOrder.trim(), contact: initialContact.trim(), n: 0 } : null,
  );
  const { register, handleSubmit, formState } = useForm<TrackValues>({
    resolver: zodResolver(trackSchema),
    defaultValues: { number: initialOrder, contact: initialContact },
  });
  const { errors } = formState;

  const { data: order, error, loading } = useApi(() => trackOrder(query!.number, query!.contact), `track:${query?.number}:${query?.contact}:${query?.n}`, !!query);

  const submit = handleSubmit((v) => setQuery((q) => ({ number: v.number, contact: v.contact, n: (q?.n ?? 0) + 1 })));
  const pending = !!query && loading;

  return (
    <div className="shell py-8 md:py-12">
      <PageHeader title="Track your order" />
      <p className="mt-3 max-w-[60ch] text-brown">Enter the order number from your confirmation and the phone number or email you used. No account needed.</p>

      <div className="mt-8 grid items-start gap-10 lg:grid-cols-[400px_1fr] lg:gap-14">
        <Ticket head={["Order lookup"]} className="p-4 pt-2 md:p-5 md:pt-2">
          <form onSubmit={submit} noValidate className="space-y-4">
            <Field label="Order number" error={errors.number?.message}>
              {(p) => <Input {...p} placeholder="FB-1023" autoComplete="off" autoCapitalize="characters" spellCheck={false} className="font-stencil uppercase" {...register("number")} />}
            </Field>
            <Field label="Phone or email" error={errors.contact?.message} hint="The one you used at checkout.">
              {(p) => <Input {...p} autoComplete="tel" {...register("contact")} />}
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
              <PackageSearch strokeWidth={1.8} />
              {pending ? "Looking it up" : "Track order"}
            </Button>
          </form>
        </Ticket>

        <div aria-live="polite" aria-atomic="false">
          {pending ? (
            <div className="space-y-4" aria-busy="true">
              <Skeleton className="h-24" />
              <Skeleton className="h-64" />
            </div>
          ) : null}

          {query && !pending && error ? <ErrorNote>{error.message}</ErrorNote> : null}

          {query && !pending && !error && order ? (
            <Ticket tone="paper" head={[`Order ${order.number}`, `Placed ${formatDate(order.createdAt)}`]} className="p-4 pt-2 md:p-6 md:pt-2">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
                <div>
                  <h2 className="font-display text-[2rem]">{ORDER_STATUS[order.status].label}</h2>
                  <p className="mt-1 text-brown">{ORDER_STATUS[order.status].hint}</p>
                </div>
                <Stamp label={ORDER_STATUS[order.status].label} tone={ORDER_STATUS[order.status].tone} shape={ORDER_STATUS[order.status].shape} rotate={-5} />
              </div>

              {order.courier || order.awb ? (
                <dl className="mb-5 grid grid-cols-2 gap-4 border-y border-line py-4">
                  {order.courier ? (
                    <div>
                      <dt className="font-stencil text-[11px] text-brown-soft">Courier</dt>
                      <dd className="mt-0.5 font-semibold">{order.courier}</dd>
                    </div>
                  ) : null}
                  {order.awb ? (
                    <div>
                      <dt className="font-stencil text-[11px] text-brown-soft">AWB number</dt>
                      <dd className="font-stencil tabular mt-0.5 break-all text-[15px]">{order.awb}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}

              {["PENDING_PAYMENT", "PLACED", "CONFIRMED", "IN_PRODUCTION", "PACKED"].includes(order.status) ? (
                <p className="mb-5 text-[15px]">
                  Estimated dispatch <strong className="font-semibold">{formatDate(order.estimatedDispatch, { day: "numeric", month: "short" })}</strong>.
                </p>
              ) : null}

              <OrderTimeline order={order} />

              <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                <p className="text-sm text-brown">
                  {order.items.length} {order.items.length === 1 ? "piece" : "pieces"}: {order.items.map((i) => i.name).join(", ")}
                </p>
                <Button asChild variant="secondary" size="sm">
                  <a href={waOrder(order.number)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle /> Ask about this order
                  </a>
                </Button>
              </div>
            </Ticket>
          ) : null}

          {!query ? (
            <p className="hidden max-w-[44ch] text-brown lg:block">Your order&apos;s progress will show here, station by station, from placed to delivered.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
