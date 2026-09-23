"use client";

import { useState } from "react";
import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { ErrorNote } from "@/components/ui/misc";
import { formatINR } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  amount: number;
  /** Runs the payment. Throw an Error with a customer-readable message to show it inline. */
  onPay: (ok: boolean) => Promise<void>;
}

/**
 * PLACEHOLDER(razorpay-test): stands in for the Razorpay Checkout window until real keys are
 * wired in (Phase 4). Nothing here moves money. Replace with `new Razorpay(options).open()`.
 */
export function TestPaymentModal({ open, onOpenChange, amount, onPay }: Props) {
  const [busy, setBusy] = useState<"ok" | "fail" | null>(null);
  const [error, setError] = useState<string>();

  async function run(ok: boolean) {
    setError(undefined);
    setBusy(ok ? "ok" : "fail");
    try {
      await onPay(ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The payment didn't go through. You haven't been charged. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!busy) {
          if (!o) setError(undefined);
          onOpenChange(o);
        }
      }}
      title="Test payment"
      description="This stands in for the Razorpay window. No real money moves."
    >
      <div className="relative space-y-4" data-placeholder="razorpay-test">
        <div className="flex items-start gap-2.5 rounded-[12px] bg-butter/40 px-4 py-3 text-sm text-cocoa">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
          <p>
            <strong className="font-semibold">Test mode.</strong> Pick an outcome to see what the shopper would see when Razorpay is connected.
          </p>
        </div>

        <div className="flex items-baseline justify-between border-y border-line py-3">
          <span className="font-semibold">FuzzBall Factory</span>
          <span className="tabular text-2xl font-bold">{formatINR(amount)}</span>
        </div>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="flex flex-col gap-2.5 pt-1">
          <Button size="lg" onClick={() => run(true)} disabled={busy !== null} aria-busy={busy === "ok"}>
            <CheckCircle2 strokeWidth={1.8} />
            {busy === "ok" ? "Confirming payment" : "Pay successfully"}
          </Button>
          <Button size="lg" variant="secondary" onClick={() => run(false)} disabled={busy !== null} aria-busy={busy === "fail"}>
            <XCircle strokeWidth={1.8} />
            {busy === "fail" ? "Simulating failure" : "Simulate failure"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
