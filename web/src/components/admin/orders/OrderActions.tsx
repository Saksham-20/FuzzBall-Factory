"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Ban, Check, Hammer, MessageCircle, PackageCheck, Truck, Undo2 } from "lucide-react";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/misc";
import { allowedNextStatuses, updateOrderStatus } from "@/lib/api/admin";
import { ApiError } from "@/lib/mock/db";
import { ORDER_STATUS } from "@/lib/status";
import type { Order, OrderStatus } from "@/lib/types";
import { CANCEL_REASONS, hasMadeToOrder, isCodToConfirm, ORDER_ACTION_COPY, orderWhatsApp } from "./helpers";
import { ReasonModal, type ReasonTemplate } from "./ReasonModal";
import { ShipForm } from "./ShipForm";
import { Spinner } from "./Spinner";

const ICON: Partial<Record<OrderStatus, typeof Check>> = { CONFIRMED: Check, IN_PRODUCTION: Hammer, PACKED: PackageCheck, SHIPPED: Truck, DELIVERED: Check };
/** Order of preference when more than one forward move is open. */
const FORWARD: OrderStatus[] = ["CONFIRMED", "IN_PRODUCTION", "PACKED", "SHIPPED", "DELIVERED"];

type ReasonKind = "CANCELLED" | "REFUNDED" | "RETURN_REQUESTED";
const REASONS: Record<ReasonKind, { templates: ReasonTemplate[]; description: string }> = {
  CANCELLED: {
    templates: CANCEL_REASONS.map((label) => ({ label })),
    description: "This note appears on the customer's order timeline.",
  },
  REFUNDED: {
    templates: ["Returned piece received and checked", "Arrived damaged", "Wrong piece sent"].map((label) => ({ label })),
    description: "This marks the order refunded and shows this note to the customer. Send the money back from your payment dashboard too.",
  },
  RETURN_REQUESTED: {
    templates: ["Arrived damaged", "Wrong piece received", "Customer changed their mind"].map((label) => ({ label })),
    description: "Use this when a customer asks for a return. It shows this note on their timeline.",
  },
};

export function OrderActions({ order, onUpdated }: { order: Order; onUpdated: (o: Order) => void }) {
  const next = allowedNextStatuses(order.status);
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>();
  const [shipOpen, setShipOpen] = useState(false);
  const [reason, setReason] = useState<ReasonKind | null>(null);
  const [codOk, setCodOk] = useState(false);

  const cod = isCodToConfirm(order);
  const wa = orderWhatsApp(order);

  /** The one place a status change runs: loading, toast, inline error, and the refreshed order. Returns success. */
  async function run(status: OrderStatus, opts?: { note?: string; courier?: string; awb?: string }, done?: string) {
    setError(null);
    setFieldErrors(undefined);
    setBusy(status);
    try {
      const updated = await updateOrderStatus(order.number, status, opts);
      onUpdated(updated);
      toast.success(done ?? ORDER_ACTION_COPY[status]?.done ?? `Order is now ${ORDER_STATUS[status].label.toLowerCase()}.`);
      return true;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Something went wrong on our side. Try again in a moment.";
      setError(msg);
      if (e instanceof ApiError && e.fields) setFieldErrors(e.fields);
      toast.error(msg);
      return false;
    } finally {
      setBusy(null);
    }
  }

  const forward = FORWARD.filter((s) => next.includes(s) && !(s === "IN_PRODUCTION" && !hasMadeToOrder(order)) && !(order.status === "RETURN_REQUESTED" && s === "DELIVERED"));
  const primary = order.status === "RETURN_REQUESTED" ? null : forward[0];
  const secondary = forward.slice(1);
  const canCancel = next.includes("CANCELLED");
  const anyBusy = busy !== null;
  const paid = order.paymentStatus === "PAID";

  const forwardButton = (s: OrderStatus, isPrimary: boolean) => {
    const Icon = ICON[s] ?? Check;
    const copy = ORDER_ACTION_COPY[s]!;
    const gated = isPrimary && cod && s === "CONFIRMED" && !codOk;
    const label = s === "CONFIRMED" && cod ? "Confirm COD order" : copy.label;
    return (
      <Button
        key={s}
        size="lg"
        variant={isPrimary ? "primary" : "secondary"}
        className="w-full"
        disabled={anyBusy || gated}
        aria-busy={busy === s}
        onClick={() => (s === "SHIPPED" ? setShipOpen(true) : void run(s))}
      >
        {busy === s ? <><Spinner /> Working…</> : <><Icon strokeWidth={1.8} /> {label}</>}
      </Button>
    );
  };

  const closed = next.length === 0;

  return (
    <Panel title="Next step">
      <div className="space-y-4">
        <p className="text-brown">{ORDER_STATUS[order.status].label}. {closed ? (order.status === "CANCELLED" ? "Nothing more to do here." : "Nothing more to do on this order.") : hint(order)}</p>

        {cod ? (
          <div className="space-y-2 rounded-[12px] bg-butter/35 p-3">
            <p className="text-[15px]">Cash on delivery. Check with the customer on WhatsApp first, then confirm.</p>
            <Button asChild variant="tape" className="w-full sm:w-auto">
              <a href={wa.href} target="_blank" rel="noopener noreferrer">
                <MessageCircle strokeWidth={1.8} /> {wa.label}
                <span className="sr-only"> (opens WhatsApp)</span>
              </a>
            </Button>
            <Checkbox label="They said yes on WhatsApp" checked={codOk} onChange={(e) => setCodOk(e.target.checked)} />
          </div>
        ) : null}

        {shipOpen ? (
          <div className="space-y-3 rounded-[12px] bg-kraft-light/60 p-3">
            <p className="font-semibold">Ship this order</p>
            <ShipForm
              busy={busy === "SHIPPED"}
              submitLabel="Mark as shipped"
              busyLabel="Shipping…"
              fieldErrors={fieldErrors}
              initial={{ courier: order.courier, awb: order.awb }}
              onCancel={() => setShipOpen(false)}
              onSubmit={async (courier, awb) => { if (await run("SHIPPED", { courier, awb })) setShipOpen(false); }}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {primary ? forwardButton(primary, true) : null}
            {secondary.map((s) => forwardButton(s, false))}

            {order.status === "RETURN_REQUESTED" ? (
              <>
                <Button size="lg" className="w-full" disabled={anyBusy} onClick={() => setReason("REFUNDED")}>
                  <Undo2 strokeWidth={1.8} /> Refund order
                </Button>
                <Button size="lg" variant="secondary" className="w-full" disabled={anyBusy} aria-busy={busy === "DELIVERED"} onClick={() => void run("DELIVERED", { note: "Return request declined." }, "Return declined. Order is back to delivered.")}>
                  {busy === "DELIVERED" ? <><Spinner /> Working…</> : "Decline return"}
                </Button>
              </>
            ) : null}

            {order.status === "DELIVERED" && next.includes("RETURN_REQUESTED") ? (
              <Button variant="ghost" className="w-full" disabled={anyBusy} onClick={() => setReason("RETURN_REQUESTED")}>
                <Undo2 strokeWidth={1.8} /> Log a return request
              </Button>
            ) : null}
          </div>
        )}

        {error && !reason && (!shipOpen || !fieldErrors) ? <ErrorNote>{error}</ErrorNote> : null}

        {canCancel ? (
          <div className="border-t border-line pt-3">
            <Button variant="ghost" className="w-full text-err" disabled={anyBusy} onClick={() => setReason("CANCELLED")}>
              <Ban strokeWidth={1.8} /> {paid ? "Cancel and refund…" : "Cancel order…"}
            </Button>
          </div>
        ) : null}
      </div>

      {reason ? (
        <ReasonModal
          open
          onOpenChange={(v) => { if (!v) { setReason(null); setError(null); } }}
          title={reason === "CANCELLED" ? (paid ? "Cancel and refund this order?" : "Cancel this order?") : reason === "REFUNDED" ? "Refund this order?" : "Log a return request"}
          description={REASONS[reason].description}
          templates={REASONS[reason].templates}
          fieldLabel="Reason"
          confirmLabel={reason === "CANCELLED" ? (paid ? "Cancel and refund" : "Cancel order") : reason === "REFUNDED" ? "Mark refunded" : "Log return request"}
          busyLabel="Saving…"
          danger={reason !== "RETURN_REQUESTED"}
          busy={busy === reason}
          error={error}
          onConfirm={async (note) => { if (await run(reason, { note }, reason === "CANCELLED" ? "Order cancelled." : reason === "REFUNDED" ? "Order marked refunded." : "Return request logged.")) setReason(null); }}
        />
      ) : null}
    </Panel>
  );
}

function hint(o: Order): string {
  switch (o.status) {
    case "PLACED": return o.paymentMethod === "COD" ? "Waiting for your WhatsApp confirmation." : "Confirm to put it in the queue.";
    case "PENDING_PAYMENT": return "Waiting for the customer to pay. It can be cancelled if they walk away.";
    case "CONFIRMED": return hasMadeToOrder(o) ? "Made-to-order pieces are next." : "Ready pieces can be packed straight away.";
    case "IN_PRODUCTION": return "Pack it when the last piece is done.";
    case "PACKED": return "Add the courier and AWB when you hand it over.";
    case "SHIPPED": return "Mark delivered when tracking says it arrived.";
    case "DELIVERED": return "Delivered. A return can be logged if the customer asks.";
    case "RETURN_REQUESTED": return "Check the photos, then refund or decline.";
    default: return "";
  }
}
