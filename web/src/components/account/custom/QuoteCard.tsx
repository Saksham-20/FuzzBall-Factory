"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Clock, Hourglass, RefreshCcw } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
import { Drawer, Modal } from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/misc";
import { acceptQuote, balanceAmount, counterQuote, countersUsed, declineQuote, depositAmount, MAX_COUNTERS, quoteExpired } from "@/lib/api/custom";
import { formatDate, formatINR } from "@/lib/format";
import { waCustom } from "@/lib/whatsapp";
import { ApiError } from "@/lib/mock/db";
import type { CustomRequest, Quote } from "@/lib/types";
import { daysLeftLabel, daysUntil, errorMessage, longDate } from "./helpers";

interface Props {
  r: CustomRequest;
  quote: Quote;
  /** Called with the fresh request after any successful mutation. */
  onChange: (next?: CustomRequest, opts?: { focusPanel?: boolean }) => void;
}

export function QuoteCard({ r, quote, onChange }: Props) {
  const [accepting, setAccepting] = useState(false);
  const [counterOpen, setCounterOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);

  const expired = quoteExpired(quote);
  const days = daysUntil(quote.validUntil);
  const used = countersUsed(r);
  const countersLeft = Math.max(0, MAX_COUNTERS - used);
  const deposit = depositAmount(quote);
  const balance = balanceAmount(quote);

  async function accept() {
    setAccepting(true);
    try {
      const next = await acceptQuote(r.number, quote.id);
      toast.success("Quote accepted. Pay the deposit to start your piece.");
      onChange(next, { focusPanel: true });
    } catch (e) {
      toast.error(errorMessage(e));
      // The quote may have expired or changed under us; refresh either way.
      onChange();
    } finally {
      setAccepting(false);
    }
  }

  return (
    <Ticket tone="paper" head={["Quote", `For ${r.number}`]} role="region" aria-labelledby="quote-title">
      <div className="space-y-5 px-1 pb-2">
        <div>
          <h2 id="quote-title" className="text-sm font-semibold text-brown">
            Price for {r.quantity > 1 ? `${r.quantity} pieces` : "your piece"}
          </h2>
          <p className="tabular text-[2.5rem] leading-tight font-extrabold">{formatINR(quote.price)}</p>
        </div>

        {expired ? (
          <div role="alert" className="rounded-[12px] bg-warn-wash px-4 py-3 text-warn">
            <p className="flex items-center gap-2 font-semibold">
              <Hourglass aria-hidden strokeWidth={1.8} className="size-4 shrink-0" />
              This quote expired on {formatDate(quote.validUntil, { day: "numeric", month: "short" })}
            </p>
            <p className="mt-1 text-[15px]">
              Message us and we can reopen it.{" "}
              <a className="font-semibold underline" href={waCustom(r.number)} target="_blank" rel="noopener noreferrer">
                Continue on WhatsApp
              </a>
            </p>
          </div>
        ) : (
          <p className={`flex items-center gap-2 text-[15px] ${days < 2 ? "font-semibold text-warn" : "text-brown"}`}>
            <Clock aria-hidden strokeWidth={1.8} className="size-4 shrink-0" />
            <span>
              Valid until <span className="tabular">{longDate(quote.validUntil)}</span> ({daysLeftLabel(days)})
            </span>
          </p>
        )}

        <dl className="divide-y divide-dashed divide-line-strong border-y border-dashed border-line-strong text-[15px]">
          {quote.breakdown.map((l) => (
            <div key={l.label} className="flex items-baseline justify-between gap-4 py-2">
              <dt>{l.label}</dt>
              <dd className="tabular font-medium">{formatINR(l.amount)}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 py-2 font-bold">
            <dt>Total</dt>
            <dd className="tabular">{formatINR(quote.price)}</dd>
          </div>
        </dl>

        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-brown">To start ({quote.depositPct}%)</dt>
            <dd className="tabular text-xl font-bold">{formatINR(deposit)}</dd>
          </div>
          <div>
            <dt className="text-sm text-brown">Before shipping</dt>
            <dd className="tabular text-xl font-bold">{formatINR(balance)}</dd>
          </div>
        </dl>

        <ul className="space-y-1.5 text-[15px]">
          <li className="flex items-center gap-2">
            <CalendarClock aria-hidden strokeWidth={1.8} className="size-4 shrink-0 text-brown" />
            Ready about <span className="tabular font-semibold">{quote.timelineDays} days</span> after the deposit
          </li>
          <li className="flex items-center gap-2">
            <RefreshCcw aria-hidden strokeWidth={1.8} className="size-4 shrink-0 text-brown" />
            <span>
              <span className="tabular font-semibold">{quote.revisions}</span> {quote.revisions === 1 ? "round" : "rounds"} of changes included
            </span>
          </li>
        </ul>

        <div>
          <h3 className="text-sm font-semibold text-brown">What&apos;s included</h3>
          <p className="mt-1 max-w-[62ch] text-[15px] leading-relaxed">{quote.scope}</p>
        </div>

        <div className="space-y-2.5 border-t border-line pt-5">
          <Button size="lg" className="w-full" onClick={accept} disabled={expired || accepting} aria-busy={accepting}>
            {accepting ? "Accepting…" : "Accept & pay deposit"}
          </Button>
          <p className="text-center text-sm text-brown">Accepting doesn&apos;t charge you. Next you&apos;ll pay {formatINR(deposit)} to start.</p>
          <Button variant="secondary" size="lg" className="w-full" onClick={() => setCounterOpen(true)} disabled={expired || countersLeft === 0}>
            Make a counter-offer
          </Button>
          <p className="text-center text-sm text-brown" id="counters-note">
            {countersLeft === 0
              ? `You've used ${used} of ${MAX_COUNTERS} counters, which is the limit. You can accept this quote, decline it, or message us.`
              : `${used} of ${MAX_COUNTERS} counters used.`}
          </p>
          <Button variant="ghost" size="lg" className="w-full" onClick={() => setDeclineOpen(true)} disabled={accepting}>
            Decline this quote
          </Button>
        </div>
      </div>

      <CounterDrawer open={counterOpen} onOpenChange={setCounterOpen} r={r} quote={quote} used={used} onChange={onChange} />
      <DeclineModal open={declineOpen} onOpenChange={setDeclineOpen} r={r} quoteId={quote.id} onChange={onChange} />
    </Ticket>
  );
}

/* ── Counter ─────────────────────────────────────────────── */

function CounterDrawer({ open, onOpenChange, r, quote, used, onChange }: { open: boolean; onOpenChange: (o: boolean) => void; r: CustomRequest; quote: Quote; used: number; onChange: Props["onChange"] }) {
  const schema = z.object({
    amount: z
      .number({ error: "Enter the amount you'd like to pay, in rupees." })
      .int("Use a whole number of rupees.")
      .positive("Enter an amount above ₹0.")
      .lt(quote.price, `A counter-offer has to be lower than the quote (${formatINR(quote.price)}).`),
    note: z.string().trim().max(500, "Keep the note under 500 characters."),
  });
  type Values = z.infer<typeof schema>;

  const { register, handleSubmit, reset, setError, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { note: "" } });
  const [formError, setFormError] = useState<string>();

  async function submit(v: Values) {
    setFormError(undefined);
    try {
      const next = await counterQuote(r.number, quote.id, v.amount, v.note);
      toast.success(`Counter-offer of ${formatINR(v.amount)} sent.`);
      onOpenChange(false);
      reset({ note: "" });
      onChange(next);
    } catch (e) {
      if (e instanceof ApiError && e.fields?.amount) setError("amount", { message: e.message });
      else setFormError(errorMessage(e));
      toast.error(errorMessage(e));
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setFormError(undefined);
      }}
      title="Counter-offer"
      description={`Counter ${used + 1} of ${MAX_COUNTERS}. The quote is ${formatINR(quote.price)}; your budget was ${formatINR(r.budgetMin)} to ${formatINR(r.budgetMax)}.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={formState.isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="counter-form" disabled={formState.isSubmitting} aria-busy={formState.isSubmitting}>
            {formState.isSubmitting ? "Sending…" : "Send counter-offer"}
          </Button>
        </>
      }
    >
      <form id="counter-form" onSubmit={handleSubmit(submit)} noValidate className="space-y-5 py-2">
        <Field label="Your price (₹)" hint={`Must be lower than ${formatINR(quote.price)}.`} error={formState.errors.amount?.message}>
          {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={quote.price - 1} step={1} autoComplete="off" className="tabular" {...register("amount", { valueAsNumber: true })} />}
        </Field>
        <Field label="A note for the maker" optional hint="Say what you'd change, like fewer pieces or a simpler design." error={formState.errors.note?.message}>
          {(p) => <Textarea {...p} rows={4} {...register("note")} />}
        </Field>
        <p className="text-[15px] text-brown">
          You can counter up to {MAX_COUNTERS} times. After you send this, we&apos;ll reply here with a new quote or accept your price.
        </p>
        <div aria-live="polite">{formError ? <ErrorNote>{formError}</ErrorNote> : null}</div>
      </form>
    </Drawer>
  );
}

/* ── Decline ─────────────────────────────────────────────── */

export function DeclineModal({ open, onOpenChange, r, quoteId, onChange }: { open: boolean; onOpenChange: (o: boolean) => void; r: CustomRequest; quoteId: string; onChange: Props["onChange"] }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  async function decline() {
    setBusy(true);
    setErr(undefined);
    try {
      const next = await declineQuote(r.number, quoteId, reason.trim() || undefined);
      toast.success("Quote declined. This work order is now closed.");
      onOpenChange(false);
      setReason("");
      onChange(next);
    } catch (e) {
      setErr(errorMessage(e));
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title="Decline this quote?"
      description="This closes the work order. You can always start a new one."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Keep the quote
          </Button>
          <Button onClick={decline} disabled={busy} aria-busy={busy}>
            {busy ? "Declining…" : "Decline quote"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Reason" optional hint="It helps us quote better next time.">
          {(p) => <Textarea {...p} rows={3} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        <div aria-live="polite">{err ? <ErrorNote>{err}</ErrorNote> : null}</div>
      </div>
    </Modal>
  );
}
