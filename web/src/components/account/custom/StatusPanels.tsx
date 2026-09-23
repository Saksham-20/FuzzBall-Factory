"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CheckCircle2, MessageCircle, PackageCheck, Truck } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, Textarea } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/misc";
import { approveFinal, balanceAmount, depositAmount, payBalance, payDeposit, requestChange } from "@/lib/api/custom";
import { formatDate, formatINR } from "@/lib/format";
import { CUSTOM_STATUS } from "@/lib/status";
import { waCustom } from "@/lib/whatsapp";
import type { CustomRequest, Quote, TimelineEvent } from "@/lib/types";
import { acceptedQuote, errorMessage } from "./helpers";
import { DeclineModal } from "./QuoteCard";
import { TestPaymentModal } from "./TestPaymentModal";

type OnChange = (next?: CustomRequest, opts?: { focusPanel?: boolean }) => void;

/* ── shared bits ─────────────────────────────────────────── */

function Panel({ id, title, children, focusOnMount }: { id: string; title: string; children: ReactNode; focusOnMount?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusOnMount) return;
    ref.current?.focus({ preventScroll: true });
    ref.current?.scrollIntoView({ block: "nearest" });
  }, [focusOnMount]);
  return (
    <Ticket tone="paper" role="region" aria-labelledby={id} head={["Next step"]}>
      <div ref={ref} tabIndex={-1} className="space-y-4 px-1 pb-2 outline-none">
        <h2 id={id} className="font-display text-[1.75rem] leading-[1.05] text-balance">
          {title}
        </h2>
        {children}
      </div>
    </Ticket>
  );
}

export function WhatsAppLink({ wo, label = "Continue on WhatsApp", variant = "secondary" }: { wo: string; label?: string; variant?: "secondary" | "ghost" }) {
  return (
    <Button asChild variant={variant} size="lg" className="w-full sm:w-auto">
      <a href={waCustom(wo)} target="_blank" rel="noopener noreferrer">
        <MessageCircle aria-hidden strokeWidth={1.8} />
        {label}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </Button>
  );
}

const Body = ({ children }: { children: ReactNode }) => <p className="max-w-[62ch] text-[15px] leading-relaxed text-brown">{children}</p>;

const photoEvents = (r: CustomRequest): TimelineEvent[] => r.events.filter((e) => e.photo).reverse();

/* ── requested / under review ─────────────────────────────── */

export function WaitingForQuotePanel({ r }: { r: CustomRequest }) {
  return (
    <Panel id="panel-waiting" title="We're reading your idea">
      <Body>{CUSTOM_STATUS[r.status].hint} The quote will appear right here, and you can accept, counter or pass on it.</Body>
      <WhatsAppLink wo={r.number} label="Add a detail on WhatsApp" />
    </Panel>
  );
}

/* ── countered ────────────────────────────────────────────── */

export function CounterSentPanel({ r, quote, onChange }: { r: CustomRequest; quote: Quote; onChange: OnChange }) {
  const [declineOpen, setDeclineOpen] = useState(false);
  return (
    <Panel id="panel-countered" title="Waiting for the maker">
      <dl className="grid grid-cols-2 gap-4 text-[15px]">
        <div>
          <dt className="text-sm text-brown">Quote was</dt>
          <dd className="tabular text-xl font-bold line-through decoration-1">{formatINR(quote.price)}</dd>
        </div>
        <div>
          <dt className="text-sm text-brown">Your counter</dt>
          <dd className="tabular text-xl font-bold">{quote.counter ? formatINR(quote.counter.amount) : "Sent"}</dd>
        </div>
      </dl>
      {quote.counter?.note ? (
        <blockquote className="max-w-[62ch] rounded-[12px] bg-cream px-4 py-3 text-[15px]">
          <span className="sr-only">Your note: </span>
          {quote.counter.note}
        </blockquote>
      ) : null}
      {quote.counter ? <p className="tabular text-sm text-brown">Sent {formatDate(quote.counter.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</p> : null}
      <Body>We&apos;ll reply here with a new quote or accept your price. Nothing is charged yet.</Body>
      <div className="flex flex-col gap-2 sm:flex-row">
        <WhatsAppLink wo={r.number} />
        <Button variant="ghost" size="lg" onClick={() => setDeclineOpen(true)}>
          Withdraw and decline
        </Button>
      </div>
      <DeclineModal open={declineOpen} onOpenChange={setDeclineOpen} r={r} quoteId={quote.id} onChange={onChange} />
    </Panel>
  );
}

/* ── deposit / balance ────────────────────────────────────── */

export function AcceptedPanel({ r }: { r: CustomRequest }) {
  return (
    <Panel id="panel-accepted" title="Quote accepted">
      <Body>Your quote is accepted. The deposit is the next step, and it will show up here.</Body>
      <WhatsAppLink wo={r.number} />
    </Panel>
  );
}

export function DepositPanel({ r, quote, onChange, focusOnMount }: { r: CustomRequest; quote: Quote; onChange: OnChange; focusOnMount?: boolean }) {
  const [open, setOpen] = useState(false);
  const amount = depositAmount(quote);
  return (
    <Panel id="panel-deposit" title="Pay the deposit to start" focusOnMount={focusOnMount}>
      <div>
        <p className="text-sm text-brown">Due now ({quote.depositPct}% of {formatINR(quote.price)})</p>
        <p className="tabular text-[2.5rem] leading-tight font-extrabold">{formatINR(amount)}</p>
      </div>
      <Body>
        The deposit is what starts your piece, and it isn&apos;t refundable once work begins. The remaining {formatINR(balanceAmount(quote))} is due after you approve the finished piece.
      </Body>
      <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
        Pay {formatINR(amount)} deposit
      </Button>
      <TestPaymentModal open={open} onOpenChange={setOpen} purpose="deposit" amount={amount} woNumber={r.number} pay={() => payDeposit(r.number)} onPaid={(n) => onChange(n)} />
    </Panel>
  );
}

export function BalancePanel({ r, quote, onChange }: { r: CustomRequest; quote: Quote; onChange: OnChange }) {
  const [open, setOpen] = useState(false);
  const amount = balanceAmount(quote);
  return (
    <Panel id="panel-balance" title="Pay the balance and we ship">
      <div>
        <p className="text-sm text-brown">Balance ({formatINR(quote.price)} minus the {formatINR(depositAmount(quote))} deposit)</p>
        <p className="tabular text-[2.5rem] leading-tight font-extrabold">{formatINR(amount)}</p>
      </div>
      <Body>You approved the final piece. Once the balance is paid, it goes into the box.</Body>
      <Button size="lg" className="w-full" onClick={() => setOpen(true)}>
        Pay {formatINR(amount)} balance
      </Button>
      <TestPaymentModal open={open} onOpenChange={setOpen} purpose="balance" amount={amount} woNumber={r.number} pay={() => payBalance(r.number)} onPaid={(n) => onChange(n)} />
    </Panel>
  );
}

/* ── in progress ──────────────────────────────────────────── */

export function ProgressPanel({ r }: { r: CustomRequest }) {
  const q = acceptedQuote(r);
  const start = r.events.find((e) => e.status === "IN_PROGRESS" || e.status === "IN_QUEUE");
  const eta = q && start ? new Date(new Date(start.at).getTime() + q.timelineDays * 86_400_000) : undefined;
  const queued = r.status === "IN_QUEUE";
  return (
    <Panel id="panel-progress" title={queued ? "In the queue" : "Being crocheted"}>
      <Body>{queued ? "Your deposit is in and your piece is next in line." : "Your piece is on the hook. Photos show up below as they're added."}</Body>
      {eta ? (
        <p className="text-[15px]">
          Estimated ready by <span className="tabular font-semibold">{formatDate(eta, { weekday: "short", day: "numeric", month: "short" })}</span>
          <span className="text-brown"> ({q?.timelineDays} days from your deposit)</span>
        </p>
      ) : null}
      <WhatsAppLink wo={r.number} label="Ask about your piece" />
    </Panel>
  );
}

export function PhotoGallery({ r, title = "Progress photos" }: { r: CustomRequest; title?: string }) {
  const photos = photoEvents(r);
  return (
    <Ticket tone="paper" role="region" aria-labelledby="panel-photos" head={["Photos", `${photos.length}`]}>
      <div className="space-y-3 px-1 pb-2">
        <h2 id="panel-photos" className="font-display text-[1.75rem] leading-[1.05]">
          {title}
        </h2>
        {photos.length === 0 ? (
          <p className="text-[15px] text-brown">No photos yet. They&apos;ll show up here as the maker adds them.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3">
            {photos.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <a href={e.photo} target="_blank" rel="noopener noreferrer" className="group block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={e.photo} alt={`Progress photo from ${formatDate(e.at)}${e.note ? `: ${e.note}` : ""}`} loading="lazy" className="aspect-[4/3] w-full rounded-[10px] bg-kraft-light object-cover" />
                  <span className="tabular mt-1 block text-sm text-brown">{formatDate(e.at, { day: "numeric", month: "short" })}</span>
                  {e.note ? <span className="block text-sm leading-snug">{e.note.replace(/^Progress photo:\s*/i, "")}</span> : null}
                  <span className="sr-only"> (opens the full photo in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Ticket>
  );
}

/* ── approval ─────────────────────────────────────────────── */

export function ApprovalPanel({ r, quote, onChange }: { r: CustomRequest; quote?: Quote; onChange: OnChange }) {
  const [approving, setApproving] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const latest = photoEvents(r)[0];
  const usedChanges = r.events.filter((e) => e.status === "CHANGE_REQUESTED").length;
  const included = quote?.revisions ?? 0;
  const extra = usedChanges >= included;

  async function approve() {
    setApproving(true);
    try {
      const next = await approveFinal(r.number);
      toast.success("Approved. Pay the balance and we'll ship it.");
      onChange(next);
    } catch (e) {
      toast.error(errorMessage(e));
      onChange();
    } finally {
      setApproving(false);
    }
  }

  return (
    <Panel id="panel-approval" title="Your piece is finished">
      {latest?.photo ? (
        <a href={latest.photo} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={latest.photo} alt="Photo of your finished piece" className="aspect-[4/3] w-full rounded-[10px] bg-kraft-light object-cover" />
          <span className="sr-only">Opens the full photo in a new tab</span>
        </a>
      ) : null}
      <Body>
        Look it over, then approve it or ask for a change.
        {quote ? ` You'll pay the ${formatINR(balanceAmount(quote))} balance next.` : ""}
      </Body>
      <p className="text-[15px]">
        <span className="tabular font-semibold">
          {Math.min(usedChanges, included)} of {included}
        </span>{" "}
        included {included === 1 ? "change" : "changes"} used.
        {extra ? <span className="text-warn"> Another change may cost extra, and we&apos;ll tell you the price first.</span> : null}
      </p>
      <div className="space-y-2.5">
        <Button size="lg" className="w-full" onClick={approve} disabled={approving} aria-busy={approving}>
          <CheckCircle2 aria-hidden strokeWidth={1.8} />
          {approving ? "Approving…" : "Approve final piece"}
        </Button>
        <Button variant="secondary" size="lg" className="w-full" onClick={() => setChangeOpen(true)} disabled={approving}>
          Request a change
        </Button>
      </div>
      <ChangeDrawer open={changeOpen} onOpenChange={setChangeOpen} r={r} extra={extra} used={usedChanges} included={included} onChange={onChange} />
    </Panel>
  );
}

function ChangeDrawer({ open, onOpenChange, r, extra, used, included, onChange }: { open: boolean; onOpenChange: (o: boolean) => void; r: CustomRequest; extra: boolean; used: number; included: number; onChange: OnChange }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (note.trim().length < 5) {
      setErr("Tell us what to change, in a few words.");
      return;
    }
    setBusy(true);
    setErr(undefined);
    try {
      const next = await requestChange(r.number, note.trim());
      if (next.extraCharge) toast.info("Change requested. It's beyond your included changes, so we'll message the extra cost before we start.");
      else toast.success("Change requested. We'll get back to work on it.");
      onOpenChange(false);
      setNote("");
      onChange(next);
    } catch (e2) {
      setErr(errorMessage(e2));
      toast.error(errorMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title="Request a change"
      description={`${Math.min(used, included)} of ${included} included ${included === 1 ? "change" : "changes"} used.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="change-form" disabled={busy} aria-busy={busy}>
            {busy ? "Sending…" : "Send change request"}
          </Button>
        </>
      }
    >
      <form id="change-form" onSubmit={submit} noValidate className="space-y-4 py-2">
        <Field label="What should change?" error={err && !busy && note.trim().length < 5 ? err : undefined} hint="Be specific, like &quot;make the scarf longer&quot; or &quot;a darker blue&quot;.">
          {(p) => <Textarea {...p} rows={5} value={note} maxLength={600} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        {extra ? (
          <p role="note" className="rounded-[12px] bg-warn-wash px-4 py-3 text-[15px] text-warn">
            This change is beyond the {included} included in your quote, so it may cost extra. We&apos;ll message you the price before we start.
          </p>
        ) : (
          <p className="text-[15px] text-brown">This is covered by your quote at no extra cost.</p>
        )}
        {err && note.trim().length >= 5 ? <ErrorNote>{err}</ErrorNote> : null}
      </form>
    </Drawer>
  );
}

/* ── shipping & done ──────────────────────────────────────── */

export function ShippingPanel({ r }: { r: CustomRequest }) {
  const shipped = [...r.events].reverse().find((e) => e.status === "SHIPPED");
  const delivered = [...r.events].reverse().find((e) => e.status === "DELIVERED");
  const title = r.status === "READY_TO_SHIP" ? "Paid in full, ready to ship" : r.status === "SHIPPED" ? "On its way" : r.status === "DELIVERED" ? "Delivered" : "All done";
  const Icon = r.status === "READY_TO_SHIP" ? PackageCheck : Truck;
  return (
    <Panel id="panel-shipping" title={title}>
      <Body>{CUSTOM_STATUS[r.status].hint}</Body>
      {r.status === "READY_TO_SHIP" ? <Body>We&apos;ll add tracking details here as soon as it&apos;s handed to the courier.</Body> : null}
      {r.status === "SHIPPED" ? (
        <div className="rounded-[12px] bg-cream px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-brown">
            <Icon aria-hidden strokeWidth={1.8} className="size-4" />
            Tracking
          </p>
          <p className="font-stencil tabular mt-1 text-[15px] [overflow-wrap:anywhere]">{shipped?.note ?? "Tracking details will appear here."}</p>
          {shipped ? <p className="tabular mt-1 text-sm text-brown">Shipped {formatDate(shipped.at, { day: "numeric", month: "short" })}</p> : null}
        </div>
      ) : null}
      {(r.status === "DELIVERED" || r.status === "CLOSED") && delivered ? <p className="tabular text-[15px]">Delivered {formatDate(delivered.at, { day: "numeric", month: "short" })}.</p> : null}
      <WhatsAppLink wo={r.number} label={r.status === "DELIVERED" || r.status === "CLOSED" ? "Message us about this piece" : "Ask about delivery"} />
    </Panel>
  );
}

/* ── ended ────────────────────────────────────────────────── */

export function EndedPanel({ r }: { r: CustomRequest }) {
  const last = [...r.events].reverse().find((e) => e.status === r.status);
  const title = r.status === "DECLINED" ? "We couldn't take this one on" : r.status === "EXPIRED" ? "This quote expired" : "This work order was cancelled";
  return (
    <Panel id="panel-ended" title={title}>
      <Body>{CUSTOM_STATUS[r.status].hint}</Body>
      {last?.note ? <p className="max-w-[62ch] rounded-[12px] bg-cream px-4 py-3 text-[15px]">{last.note}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild size="lg" className="w-full sm:w-auto">
          <Link href="/custom">Start a new work order</Link>
        </Button>
        <WhatsAppLink wo={r.number} label={r.status === "EXPIRED" ? "Ask to reopen on WhatsApp" : "Talk to us on WhatsApp"} />
      </div>
    </Panel>
  );
}
