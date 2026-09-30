"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/admin/ui";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/misc";
import { listPayments, refundPayment } from "@/lib/api/admin";
import { useApi } from "@/lib/api/useApi";
import { formatDate, formatINR } from "@/lib/format";
import { SITE } from "@/lib/site";
import type { AdminPayment } from "@/lib/types";

const PURPOSE: Record<AdminPayment["purpose"], string> = { ORDER: "Order payment", DEPOSIT: "Deposit", BALANCE: "Balance" };
const STATUS_TONE = { PAID: "ready", REFUNDED: "sold", FAILED: "err", PENDING: "sample", COD_DUE: "sample" } as const;

/**
 * Money movements on one order or work order, with the refunds Razorpay is still working on and a manual refund.
 * Real API only: sample data has no gateway (renders nothing). A refund the system could not send by itself shows up
 * here as FAILED with the reason; this is where the maker finishes it by hand.
 */
export function RefundPanel({ order, request }: { order?: string; request?: string }) {
  const { data, error, reload } = useApi(() => listPayments({ order, request }), `admin-payments:${order ?? request}`);
  const [target, setTarget] = useState<AdminPayment | null>(null);
  if (SITE.useMock) return null;

  const payments = data ?? [];
  return (
    <Panel title="Payments and refunds">
      {error ? (
        <ErrorNote onRetry={reload}>{error.message || "Payments didn't load."}</ErrorNote>
      ) : payments.length === 0 ? (
        <p className="text-brown">No online payments on this yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {payments.map((p) => (
            <li key={p.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {PURPOSE[p.purpose]} <span className="tabular">{formatINR(p.amount)}</span>
                  </p>
                  <p className="text-sm text-brown">{p.paidAt ? `Paid ${formatDate(p.paidAt, { day: "numeric", month: "short", year: "numeric" })}` : p.failureReason ?? "Not paid"}</p>
                </div>
                <Badge tone={STATUS_TONE[p.status]}>{p.status === "REFUNDED" ? "Refunded" : p.status === "PAID" ? "Paid" : p.status === "FAILED" ? "Failed" : "Pending"}</Badge>
              </div>
              {p.refundedAmount > 0 ? <p className="text-sm text-brown">Refunded so far: {formatINR(p.refundedAmount)}</p> : null}
              {p.refunds.map((r) => (
                <p key={r.id} className={r.status === "FAILED" ? "text-sm font-medium text-err" : "text-sm text-brown"}>
                  Refund {formatINR(r.amount)}:{" "}
                  {r.status === "DONE" ? "sent" : r.status === "FAILED" ? `gave up after ${r.attempts} tries. Refund it by hand.` : `retrying (attempt ${r.attempts})`}
                  {r.lastError && r.status !== "DONE" ? ` (${r.lastError})` : ""}
                </p>
              ))}
              {p.refundable > 0 ? (
                <Button variant="secondary" onClick={() => setTarget(p)}>
                  Refund up to {formatINR(p.refundable)}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {target ? <RefundModal payment={target} onClose={() => setTarget(null)} onDone={() => { setTarget(null); reload(); }} /> : null}
    </Panel>
  );
}

function RefundModal({ payment, onClose, onDone }: { payment: AdminPayment; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(payment.refundable));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const value = Number(amount);
  const amountError = !/^\d+$/.test(amount.trim()) || value < 1 || value > payment.refundable ? `Enter a whole number of rupees between 1 and ${payment.refundable}.` : undefined;
  const reasonError = reason.trim().length < 3 ? "Say why, in a few words. It goes in the audit log." : undefined;

  async function submit() {
    if (amountError || reasonError) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await refundPayment(payment.id, { amount: value === payment.refundable ? undefined : value, reason: reason.trim() });
      toast.success(res.pending > 0 ? `Refund of ${formatINR(res.pending)} started. It will retry until Razorpay accepts it.` : `Refunded ${formatINR(res.refunded)}.`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The refund didn't go through. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
      title="Refund this payment"
      description="Money goes back to the customer's original payment method. This can't be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button className="bg-err text-cream [@media(hover:hover)_and_(pointer:fine)]:hover:bg-err/90" onClick={submit} disabled={busy || !!amountError || !!reasonError} aria-busy={busy}>
            {busy ? "Refunding…" : `Refund ${amountError ? "" : formatINR(value)}`.trim()}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Amount (₹)" error={amountError} hint={`Up to ${formatINR(payment.refundable)} can still be refunded.`}>
          {(p) => <Input {...p} inputMode="numeric" className="tabular" value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <Field label="Reason" error={reason ? reasonError : undefined}>
          {(p) => <Input {...p} value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </div>
    </Modal>
  );
}
