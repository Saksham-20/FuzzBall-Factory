"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, FileDown, MessageCircle, Truck, Undo2 } from "lucide-react";
import { AccountHeading } from "@/components/account/AccountShell";
import { orderProgress } from "@/components/account/orderSteps";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { Field, Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import { OrderStamp } from "@/components/ui/StatusStamp";
import { EventLog, Timeline } from "@/components/ui/Timeline";
import * as orders from "@/lib/api/orders";
import { useApi } from "@/lib/api/useApi";
import { ApiError } from "@/lib/mock/db";
import { formatDate, formatINR } from "@/lib/format";
import { COUNTRIES, ORDER_STATUS } from "@/lib/status";
import { waOrder } from "@/lib/whatsapp";
import type { Order, PaymentStatus } from "@/lib/types";

const CANCELLABLE = ["PENDING_PAYMENT", "PLACED", "CONFIRMED"];
const RETURN_WINDOW_DAYS = 7;

const PAYMENT_STATUS: Record<PaymentStatus, string> = {
  PENDING: "Awaiting payment",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
  COD_DUE: "Pay when it arrives",
};

type ReturnState = "eligible" | "closed" | "blocked" | "none";

function returnState(o: Order): ReturnState {
  if (o.status !== "DELIVERED") return "none";
  if (o.items.some((i) => i.fulfilment === "MADE_TO_ORDER" || i.personalization)) return "blocked";
  const delivered = o.events.findLast((e) => e.status === "DELIVERED")?.at ?? o.createdAt;
  const days = (Date.now() - new Date(delivered).getTime()) / 86_400_000;
  return days > RETURN_WINDOW_DAYS ? "closed" : "eligible";
}

const dateTime = { day: "numeric", month: "short", year: "numeric" } as const;

export function OrderDetailClient({ number }: { number: string }) {
  const { data: order, error, loading, reload, setData } = useApi(() => orders.getOrder(number), `order-${number}`);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);

  return (
    <div>
      <Link href="/account/orders" className="press -ml-2 inline-flex min-h-11 items-center gap-2 rounded-full px-2 font-semibold text-brown">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
        All orders
      </Link>

      {loading && !order ? (
        <div className="mt-4 space-y-4" role="status" aria-label="Loading order">
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="h-64 rounded-ticket" />
        </div>
      ) : error || !order ? (
        <div className="mt-4">
          {error instanceof ApiError && (error.status === 404 || error.status === 403) ? (
            <EmptyState
              title="We can't show that order"
              action={
                <Button asChild>
                  <Link href="/account/orders">Back to your orders</Link>
                </Button>
              }
            >
              {error.message} If you placed it as a guest, use Track order with your order number and phone or email.
            </EmptyState>
          ) : (
            <ErrorNote onRetry={reload}>{error?.message ?? "We couldn't load this order."}</ErrorNote>
          )}
        </div>
      ) : (
        <OrderBody
          order={order}
          onCancel={() => setCancelOpen(true)}
          onReturn={() => setReturnOpen(true)}
        />
      )}

      {order ? (
        <>
          <CancelModal
            order={order}
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            onDone={(o) => {
              setData(o);
              setCancelOpen(false);
              toast.success(`Order ${o.number} is cancelled.`);
            }}
          />
          <ReturnModal
            order={order}
            open={returnOpen}
            onOpenChange={setReturnOpen}
            onDone={(o) => {
              setData(o);
              setReturnOpen(false);
              toast.success("Return requested. We'll message you on WhatsApp with the next steps.");
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h2 className="font-display text-[2rem]">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function OrderBody({ order: o, onCancel, onReturn }: { order: Order; onCancel: () => void; onReturn: () => void }) {
  const progress = orderProgress(o);
  const country = COUNTRIES.find((c) => c.code === o.address.country)?.name ?? o.address.country;
  const rs = returnState(o);
  const active = !["CANCELLED", "REFUNDED", "DELIVERED", "RETURN_REQUESTED"].includes(o.status);

  return (
    <div className="mt-2">
      <AccountHeading title={<>Order {o.number}</>}>
        <OrderStamp status={o.status} />
      </AccountHeading>
      <p className="tabular mt-3 text-brown">
        Placed {formatDate(o.createdAt, dateTime)}. {ORDER_STATUS[o.status].hint}
        {active && o.status !== "PENDING_PAYMENT" && o.status !== "SHIPPED" ? <> Estimated dispatch {formatDate(o.estimatedDispatch, { day: "numeric", month: "short" })}.</> : null}
      </p>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-14">
        <div className="space-y-12">
          <Section title="Items">
            <ul className="divide-y divide-line border-y border-line">
              {o.items.map((i, n) => (
                <li key={`${i.productId}-${n}`} className="flex gap-4 py-4">
                  <div className="relative size-20 shrink-0 overflow-hidden rounded-[10px] bg-paper">
                    <Image src={i.image} alt={i.name} fill sizes="80px" className="object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{i.name}</p>
                    <p className="text-[15px] text-brown">
                      {i.colour}
                      {i.size ? `, ${i.size}` : ""}
                    </p>
                    {i.personalization ? <p className="text-[15px] text-brown">Personalised: &ldquo;{i.personalization}&rdquo;</p> : null}
                    <Badge tone={i.fulfilment === "READY" ? "ready" : "mto"} className="mt-2">
                      {i.fulfilment === "READY" ? "Ready to ship" : "Made to order"}
                    </Badge>
                  </div>
                  <p className="tabular text-right text-[15px]">
                    <span className="block font-bold">{formatINR(i.unitPrice * i.qty)}</span>
                    {i.qty > 1 ? <span className="text-brown">{i.qty} × {formatINR(i.unitPrice)}</span> : null}
                  </p>
                </li>
              ))}
            </ul>
            <dl className="tabular mt-4 space-y-1.5 text-[15px]">
              <Row label="Subtotal" value={formatINR(o.subtotal)} />
              <Row label="Shipping" value={o.shipping === 0 ? "Free" : formatINR(o.shipping)} />
              {o.codFee > 0 ? <Row label="Cash on delivery fee" value={formatINR(o.codFee)} /> : null}
              {o.giftWrap > 0 ? <Row label="Gift wrap" value={formatINR(o.giftWrap)} /> : null}
              {o.discount > 0 ? <Row label="Discount" value={`−${formatINR(o.discount)}`} /> : null}
              <div className="flex items-baseline justify-between border-t border-line-strong pt-3 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatINR(o.total)}</dd>
              </div>
            </dl>
          </Section>

          <div className="grid gap-10 sm:grid-cols-2">
            <Section title="Delivery">
              <address className="font-stencil text-[13px] leading-relaxed not-italic">
                {o.address.name}
                <br />
                {o.address.line1}
                {o.address.line2 ? (
                  <>
                    <br />
                    {o.address.line2}
                  </>
                ) : null}
                <br />
                {o.address.city}, {o.address.state} {o.address.postalCode}
                <br />
                {country}
                <br />
                <span className="tabular">{o.address.phone}</span>
              </address>
              {o.giftNote ? (
                <p className="mt-3 text-[15px] text-brown">
                  <span className="font-semibold text-cocoa">Gift note:</span> {o.giftNote}
                </p>
              ) : null}
            </Section>
            <Section title="Payment">
              <p className="font-semibold">{o.paymentMethod === "COD" ? "Cash on delivery" : "Online (UPI, card or netbanking)"}</p>
              <p className="text-[15px] text-brown">{PAYMENT_STATUS[o.paymentStatus]}</p>
            </Section>
          </div>
        </div>

        <div className="space-y-12">
          <Section title="Progress">
            <Timeline steps={progress.steps} current={progress.current} waiting={o.status === "PENDING_PAYMENT"} />
            {o.courier || o.awb ? (
              <p className="mt-6 flex items-start gap-3 text-[15px]">
                <Truck className="mt-0.5 size-5 shrink-0 text-brown" strokeWidth={1.8} aria-hidden />
                <span>
                  Shipped with <span className="font-semibold">{o.courier ?? "our courier"}</span>
                  {o.awb ? (
                    <>
                      . Tracking number <span className="font-stencil tabular text-[13px]">{o.awb}</span>
                    </>
                  ) : null}
                </span>
              </p>
            ) : null}
          </Section>
          <Section title="Activity">
            <EventLog events={o.events} kind="order" />
          </Section>
        </div>
      </div>

      <section aria-label="Help and actions" className="mt-14 border-t border-line pt-8">
        <h2 className="font-display text-[2rem]">Need help?</h2>
        <p className="mt-2 max-w-[56ch] text-brown">Message us with your order number and we&apos;ll sort it out. Most things are quickest on WhatsApp.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <a href={waOrder(o.number)} target="_blank" rel="noopener noreferrer">
              <MessageCircle strokeWidth={1.8} aria-hidden />
              Ask about this order on WhatsApp
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </Button>
          {CANCELLABLE.includes(o.status) ? (
            <Button variant="secondary" onClick={onCancel}>
              Cancel order
            </Button>
          ) : null}
          {rs === "eligible" ? (
            <Button variant="secondary" onClick={onReturn}>
              <Undo2 strokeWidth={1.8} aria-hidden />
              Request a return
            </Button>
          ) : null}
          {/* PLACEHOLDER(invoice-download): needs the real GST invoice PDF from the API; the control is inert until then. */}
          <div data-placeholder="invoice-download" className="relative">
            <Button variant="ghost" disabled aria-describedby="invoice-note">
              <FileDown strokeWidth={1.8} aria-hidden />
              Download invoice
            </Button>
          </div>
        </div>
        <p id="invoice-note" className="mt-2 text-sm text-brown-soft">
          Invoice downloads are coming soon.
        </p>
        {rs === "closed" ? <p className="mt-4 max-w-[56ch] text-[15px] text-brown">The {RETURN_WINDOW_DAYS}-day return window for this order has closed. If something is wrong with your piece, message us on WhatsApp and we&apos;ll help.</p> : null}
        {rs === "blocked" ? <p className="mt-4 max-w-[56ch] text-[15px] text-brown">Made-to-order and personalised pieces can&apos;t be returned unless they arrive damaged. If yours did, message us on WhatsApp with photos.</p> : null}
        {o.status === "CANCELLED" ? <p className="mt-4 max-w-[56ch] text-[15px] text-brown">This order was cancelled. Paid orders are refunded to the original payment method.</p> : null}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-brown">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function CancelModal({ order, open, onOpenChange, onDone }: { order: Order; open: boolean; onOpenChange: (o: boolean) => void; onDone: (o: Order) => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      onDone(await orders.cancelOrder(order.number, reason.trim() || undefined));
      setReason("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't cancel this order just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!busy) {
          onOpenChange(o);
          if (!o) setError("");
        }
      }}
      title="Cancel this order?"
      description={`Order ${order.number} will be cancelled and the pieces go back on the shelf. This can't be undone.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Keep order
          </Button>
          <Button onClick={confirm} disabled={busy} aria-busy={busy}>
            {busy ? "Cancelling…" : "Cancel order"}
          </Button>
        </>
      }
    >
      {error ? <div className="mb-4"><ErrorNote>{error}</ErrorNote></div> : null}
      <Field label="Reason" optional>
        {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Ordered by mistake, changed my mind…" className="min-h-20" />}
      </Field>
    </Modal>
  );
}

const returnSchema = z.object({ reason: z.string().trim().min(10, "Tell us what's wrong in a sentence or two, so we can help quickly.").max(500, "Keep it under 500 characters.") });
type ReturnValues = z.infer<typeof returnSchema>;

function ReturnModal({ order, open, onOpenChange, onDone }: { order: Order; open: boolean; onOpenChange: (o: boolean) => void; onDone: (o: Order) => void }) {
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReturnValues>({ resolver: zodResolver(returnSchema), defaultValues: { reason: "" } });

  async function onSubmit(v: ReturnValues) {
    setError("");
    try {
      onDone(await orders.requestReturn(order.number, v.reason));
      reset();
    } catch (e) {
      // The API explains why a return isn't possible (window, made-to-order, personalised). Show it as is.
      setError(e instanceof ApiError ? e.message : "We couldn't send your request just now. Please try again.");
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!isSubmitting) {
          onOpenChange(o);
          if (!o) setError("");
        }
      }}
      title="Request a return"
      description={`Tell us what's wrong with order ${order.number}. For the quickest help, send photos or an unboxing video on WhatsApp after you submit.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Never mind
          </Button>
          <Button type="submit" form="return-form" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Sending…" : "Send return request"}
          </Button>
        </>
      }
    >
      <form id="return-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Field label="What's the problem?" error={errors.reason?.message}>
          {(p) => <Textarea {...p} {...register("reason")} maxLength={500} />}
        </Field>
      </form>
    </Modal>
  );
}
