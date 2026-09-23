"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { ErrorNote } from "@/components/ui/misc";
import { formatINR } from "@/lib/format";
import type { CustomRequest } from "@/lib/types";
import { errorMessage } from "./helpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** e.g. "deposit" or "balance" */
  purpose: string;
  amount: number;
  woNumber: string;
  pay: () => Promise<CustomRequest>;
  onPaid: (next: CustomRequest) => void;
}

/**
 * PLACEHOLDER(razorpay-checkout): stand-in for Razorpay Checkout. The real flow opens Razorpay
 * with a server-created order and confirms via webhook; here two buttons fake the outcome.
 */
export function TestPaymentModal({ open, onOpenChange, purpose, amount, woNumber, pay, onPaid }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string>();

  function close(v: boolean) {
    if (busy) return;
    if (!v) setFailed(undefined);
    onOpenChange(v);
  }

  async function success() {
    setBusy(true);
    setFailed(undefined);
    try {
      const next = await pay();
      toast.success(`${purpose[0].toUpperCase()}${purpose.slice(1)} received. Thank you!`);
      onOpenChange(false);
      onPaid(next);
    } catch (e) {
      setFailed(errorMessage(e, "The payment didn't go through."));
      toast.error(errorMessage(e, "The payment didn't go through."));
    } finally {
      setBusy(false);
    }
  }

  function simulateFailure() {
    setFailed("The payment failed and you were not charged. Try again, or use a different method.");
  }

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title="Test payment"
      description={`Paying the ${purpose} for ${woNumber}.`}
      footer={
        <>
          <Button variant="ghost" onClick={simulateFailure} disabled={busy}>
            Simulate failure
          </Button>
          <Button onClick={success} disabled={busy} aria-busy={busy}>
            {busy ? "Paying…" : `Pay ${formatINR(amount)} successfully`}
          </Button>
        </>
      }
    >
      <div data-placeholder="razorpay-checkout" className="relative space-y-3">
        <p className="font-stencil w-fit rounded-[6px] border-2 border-dashed border-warn px-2.5 py-1 text-[12px] text-warn">Test mode: no real money moves</p>
        <p className="tabular text-3xl font-bold">{formatINR(amount)}</p>
        <p className="text-[15px] text-brown">
          This stands in for Razorpay (UPI, cards, netbanking). Pick an outcome to see how the work order responds.
        </p>
        <div aria-live="polite">{failed ? <ErrorNote>{failed}</ErrorNote> : null}</div>
      </div>
    </Modal>
  );
}
