"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Ban, Camera, Check, MessageCircle, MessageSquare, PackageCheck, Send, Truck } from "lucide-react";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { ErrorNote } from "@/components/ui/misc";
import { acceptCounter, addProgress, declineCustom, markCustomDelivered, markCustomShipped, markUnderReview, requestApproval } from "@/lib/api/admin";
import { MAX_COUNTERS, balanceAmount, countersUsed, depositAmount, liveQuote } from "@/lib/api/custom";
import { formatDate, formatINR } from "@/lib/format";
import { ApiError } from "@/lib/mock/db";
import { CUSTOM_STATUS } from "@/lib/status";
import type { CustomRequest } from "@/lib/types";
import { ReasonModal } from "../orders/ReasonModal";
import { ShipForm } from "../orders/ShipForm";
import { Spinner } from "../orders/Spinner";
import { firstName } from "../orders/wa";
import { COMPOSER_ID } from "./Thread";
import { workOrderWhatsApp } from "./wa";
import { DECLINE_TEMPLATES, OPEN_FOR_QUOTE, moverOf } from "./workflow";

type Op = "review" | "accept" | "decline" | "progress" | "approval" | "ship" | "deliver";

interface Props {
  request: CustomRequest;
  onUpdated: (r: CustomRequest) => void;
  /** For calls that return nothing (mark under review). */
  onRefresh: () => void;
  openBuilder: () => void;
  /** Set when the licensed-character hint's button opened the decline dialog. */
  declineOpen: boolean;
  setDeclineOpen: (open: boolean) => void;
  declineInitial?: string;
}

export function CustomActions({ request: r, onUpdated, onRefresh, openBuilder, declineOpen, setDeclineOpen, declineInitial }: Props) {
  const [busy, setBusy] = useState<Op | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>();
  const [shipOpen, setShipOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);

  const s = r.status;
  const q = liveQuote(r);
  const counterQuote = r.quotes.find((x) => x.status === "COUNTERED" && x.counter);
  const wa = workOrderWhatsApp(r);
  const anyBusy = busy !== null;
  const canQuote = OPEN_FOR_QUOTE.includes(s);
  const canDecline = canQuote;
  const inWork = s === "IN_QUEUE" || s === "IN_PROGRESS";

  /** Runs one API call with loading, toast, and an inline error. Returns success. */
  async function run(op: Op, fn: () => Promise<CustomRequest | void>, done: string) {
    setError(null);
    setFieldErrors(undefined);
    setBusy(op);
    try {
      const updated = await fn();
      if (updated) onUpdated(updated);
      else onRefresh();
      toast.success(done);
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

  const focusComposer = () => {
    const el = document.getElementById(COMPOSER_ID);
    el?.scrollIntoView({ block: "center" });
    el?.querySelector("textarea")?.focus({ preventScroll: true });
  };

  const status = (() => {
    switch (s) {
      case "REQUESTED": return "New request. Read it through, then send a quote, or decline if it isn't for you.";
      case "UNDER_REVIEW": return "You're looking at this one. Send a quote when you're ready.";
      case "QUOTED": return q ? `Quote of ${formatINR(q.price)} sent. Valid until ${formatDate(q.validUntil)}.` : "Quote sent.";
      case "COUNTERED": return "The customer made a counter-offer.";
      case "EXPIRED": return "The quote expired without an answer. Send a fresh one to reopen it.";
      case "ACCEPTED":
      case "DEPOSIT_PENDING": return q ? `Quote accepted. Start once the ${formatINR(depositAmount(q))} deposit is in.` : "Quote accepted.";
      case "IN_QUEUE":
      case "IN_PROGRESS": return "Deposit is in. Post updates as you go, and request approval when it's finished.";
      case "AWAITING_APPROVAL": return "Final photos are with the customer.";
      case "BALANCE_PENDING": return q ? `Approved. Ship after the ${formatINR(balanceAmount(q))} balance is paid.` : "Approved. Ship after the balance is paid.";
      case "READY_TO_SHIP": return "Paid in full. Pack it and add the courier details.";
      case "SHIPPED": return "On its way. Mark delivered when tracking says it arrived.";
      case "DELIVERED": return "Delivered. Nothing more to do.";
      case "CLOSED": return "Closed. Nothing more to do.";
      case "DECLINED": return "You declined this request.";
      case "CANCELLED": return "The customer cancelled this work order.";
    }
  })();

  return (
    <Panel title="Next step">
      <div className="space-y-4">
        <p className="text-brown"><span className="font-semibold text-cocoa">{CUSTOM_STATUS[s].label}.</span> {status}</p>

        {/* Countered */}
        {s === "COUNTERED" && counterQuote?.counter ? (
          <div className="space-y-3 rounded-[12px] bg-butter/35 p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <p className="tabular text-2xl font-bold">{formatINR(counterQuote.counter.amount)}</p>
              <p className="tabular text-sm text-brown">you quoted {formatINR(counterQuote.price)} · {Math.round((1 - counterQuote.counter.amount / counterQuote.price) * 100)}% lower</p>
            </div>
            {counterQuote.counter.note ? <p className="max-w-[60ch] text-[15px]">“{counterQuote.counter.note}”</p> : null}
            <p className="tabular text-sm text-brown">
              Deposit {formatINR(depositAmount({ price: counterQuote.counter.amount, depositPct: counterQuote.depositPct }))} · balance {formatINR(balanceAmount({ price: counterQuote.counter.amount, depositPct: counterQuote.depositPct }))}
            </p>
            <p className="text-sm text-brown">Counters used: {countersUsed(r)} of {MAX_COUNTERS}.</p>
          </div>
        ) : null}

        {/* Inline forms */}
        {shipOpen ? (
          <div className="space-y-3 rounded-[12px] bg-kraft-light/60 p-3">
            <p className="font-semibold">Ship this work order</p>
            <ShipForm
              busy={busy === "ship"}
              submitLabel="Mark as shipped"
              busyLabel="Shipping…"
              fieldErrors={fieldErrors}
              onCancel={() => setShipOpen(false)}
              onSubmit={async (courier, awb) => { if (await run("ship", () => markCustomShipped(r.number, courier, awb), "Marked as shipped.")) setShipOpen(false); }}
            />
          </div>
        ) : null}
        {approvalOpen ? (
          <ProgressForm
            key="approval"
            title="Ask the customer to approve"
            hint="Attach the finished photo. They approve it, then pay the balance."
            noteLabel="Note to the customer"
            photoRequired
            submitLabel="Request approval"
            busyLabel="Sending…"
            busy={busy === "approval"}
            onCancel={() => setApprovalOpen(false)}
            onSubmit={async (note, photo) => { if (await run("approval", () => requestApproval(r.number, note || undefined, photo), "Approval requested.")) setApprovalOpen(false); }}
            noteOptional
          />
        ) : null}
        {inWork && !approvalOpen ? (
          <ProgressForm
            key="progress"
            title="Post a progress update"
            hint="Customers see this on their work order, with the photo."
            noteLabel="What's new"
            submitLabel="Post update"
            busyLabel="Posting…"
            busy={busy === "progress"}
            onSubmit={(note, photo) => run("progress", () => addProgress(r.number, note, photo), "Progress posted.")}
          />
        ) : null}

        {/* Buttons */}
        {!shipOpen ? (
          <div className="flex flex-col gap-2">
            {canQuote && s !== "COUNTERED" ? (
              <Button size="lg" className="w-full" disabled={anyBusy} onClick={openBuilder}>
                <Send strokeWidth={1.8} /> {s === "EXPIRED" ? "Send a fresh quote" : "Write a quote"}
              </Button>
            ) : null}
            {s === "REQUESTED" ? (
              <Button size="lg" variant="secondary" className="w-full" disabled={anyBusy} aria-busy={busy === "review"} onClick={() => void run("review", () => markUnderReview(r.number), "Marked as under review.")}>
                {busy === "review" ? <><Spinner /> Working…</> : <><Check strokeWidth={1.8} /> Mark under review</>}
              </Button>
            ) : null}

            {s === "COUNTERED" && counterQuote?.counter ? (
              <>
                <Button size="lg" className="w-full" disabled={anyBusy} aria-busy={busy === "accept"} onClick={() => void run("accept", () => acceptCounter(r.number), `Counter accepted at ${formatINR(counterQuote.counter!.amount)}. Deposit is due.`)}>
                  {busy === "accept" ? <><Spinner /> Accepting…</> : <><Check strokeWidth={1.8} /> Accept {formatINR(counterQuote.counter.amount)}</>}
                </Button>
                <Button size="lg" variant="secondary" className="w-full" disabled={anyBusy} onClick={openBuilder}>
                  <Send strokeWidth={1.8} /> Send a new quote
                </Button>
              </>
            ) : null}

            {inWork && !approvalOpen ? (
              <Button size="lg" variant="secondary" className="w-full" disabled={anyBusy} onClick={() => setApprovalOpen(true)}>
                <Camera strokeWidth={1.8} /> Request approval…
              </Button>
            ) : null}
            {s === "READY_TO_SHIP" ? (
              <Button size="lg" className="w-full" disabled={anyBusy} onClick={() => setShipOpen(true)}>
                <Truck strokeWidth={1.8} /> Mark shipped…
              </Button>
            ) : null}
            {s === "SHIPPED" ? (
              <Button size="lg" className="w-full" disabled={anyBusy} aria-busy={busy === "deliver"} onClick={() => void run("deliver", () => markCustomDelivered(r.number), "Marked as delivered.")}>
                {busy === "deliver" ? <><Spinner /> Working…</> : <><PackageCheck strokeWidth={1.8} /> Mark delivered</>}
              </Button>
            ) : null}

            {moverOf(s) === "customer" ? (
              <>
                <Button asChild variant="tape" className="w-full">
                  <a href={wa.href} target="_blank" rel="noopener noreferrer">
                    <MessageCircle strokeWidth={1.8} /> {wa.label}
                    <span className="sr-only"> (opens WhatsApp)</span>
                  </a>
                </Button>
                <Button variant="ghost" className="w-full" onClick={focusComposer}>
                  <MessageSquare strokeWidth={1.8} /> Message in the thread
                </Button>
              </>
            ) : null}
          </div>
        ) : null}

        {error && !declineOpen && (!shipOpen || !fieldErrors) ? <ErrorNote>{error}</ErrorNote> : null}

        {canDecline ? (
          <div className="border-t border-line pt-3">
            <Button variant="ghost" className="w-full text-err" disabled={anyBusy} onClick={() => setDeclineOpen(true)}>
              <Ban strokeWidth={1.8} /> Decline this request…
            </Button>
          </div>
        ) : null}
      </div>

      {declineOpen ? (
        <ReasonModal
          open
          onOpenChange={(v) => { setDeclineOpen(v); if (!v) setError(null); }}
          title="Decline this request?"
          description={`This message goes to ${firstName(r.customerName)} and ends the work order. Edit it so it sounds like you.`}
          templates={DECLINE_TEMPLATES}
          initial={declineInitial}
          fieldLabel="Message to the customer"
          confirmLabel="Decline request"
          busyLabel="Declining…"
          danger
          busy={busy === "decline"}
          error={error}
          onConfirm={async (reason) => { if (await run("decline", () => declineCustom(r.number, reason), "Request declined.")) setDeclineOpen(false); }}
        />
      ) : null}
    </Panel>
  );
}

interface ProgressFormProps {
  title: string;
  hint: string;
  noteLabel: string;
  submitLabel: string;
  busyLabel: string;
  busy: boolean;
  photoRequired?: boolean;
  noteOptional?: boolean;
  onCancel?: () => void;
  onSubmit: (note: string, photo?: string) => boolean | void | Promise<boolean | void>;
}

/** Note + one photo. Used for progress updates and for the final-approval request. */
function ProgressForm({ title, hint, noteLabel, submitLabel, busyLabel, busy, photoRequired, noteOptional, onCancel, onSubmit }: ProgressFormProps) {
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [errs, setErrs] = useState<{ note?: string; photo?: string }>({});

  async function submit() {
    if (busy) return;
    const next: typeof errs = {};
    if (!noteOptional && note.trim().length < 2) next.note = "Add a short note for the customer.";
    if (photoRequired && photos.length === 0) next.photo = "Add the final photo so the customer can approve.";
    setErrs(next);
    if (next.note || next.photo) return;
    const ok = await onSubmit(note.trim(), photos[0]);
    if (ok) { setNote(""); setPhotos([]); }
  }

  return (
    <div className="space-y-3 rounded-[12px] bg-kraft-light/60 p-3">
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-brown">{hint}</p>
      </div>
      <Field label={noteLabel} optional={noteOptional} error={errs.note}>
        {(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => { setNote(e.target.value); if (errs.note) setErrs((x) => ({ ...x, note: undefined })); }} />}
      </Field>
      <div>
        <ImageUploader label={photoRequired ? "Final photo" : "Photo"} hint={photoRequired ? undefined : "Optional, but customers love it."} value={photos} onChange={(v) => { setPhotos(v); if (v.length) setErrs((x) => ({ ...x, photo: undefined })); }} max={1} />
        {errs.photo ? <p role="alert" className="mt-1.5 text-sm font-medium text-err">{errs.photo}</p> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void submit()} disabled={busy} aria-busy={busy}>{busy ? <><Spinner /> {busyLabel}</> : submitLabel}</Button>
        {onCancel ? <Button variant="ghost" disabled={busy} onClick={onCancel}>Not yet</Button> : null}
      </div>
    </div>
  );
}
