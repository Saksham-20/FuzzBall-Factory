"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { ApiError } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { CUSTOMER_STATUS_LABEL, KIND_LABEL, categoryLabel } from "@/lib/support";
import type { Ticket, TicketStatus } from "@/lib/types";

const TONE: Record<TicketStatus, "mto" | "ooak" | "ready" | "sold"> = { OPEN: "mto", WAITING_CUSTOMER: "ooak", RESOLVED: "ready", CLOSED: "sold" };
const when = (iso: string) => formatDate(iso, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const day = (iso: string) => formatDate(iso, { day: "numeric", month: "long", year: "numeric" });

/** A customer's request: where it stands, the conversation, and a box to answer. Shared by the emailed link and the account. */
export function TicketThread({ ticket, onReply }: { ticket: Ticket; onReply: (body: string) => Promise<Ticket> }) {
  const [current, setCurrent] = useState(ticket);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const open = current.status === "OPEN" || current.status === "WAITING_CUSTOMER";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    if (!text.trim()) {
      setError("Write a message first.");
      return;
    }
    setError(undefined);
    setSending(true);
    try {
      setCurrent(await onReply(text.trim()));
      setText("");
      toast.success("Sent. We will reply by email.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "We couldn't send that. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="ticket-h" className="rounded-ticket bg-paper p-5 shadow-ticket sm:p-7">
        <div className="flex flex-wrap items-center gap-3">
          <h1 id="ticket-h" className="font-display text-[clamp(2rem,5vw,3rem)]">
            {current.number}
          </h1>
          <Badge tone={TONE[current.status]}>{CUSTOMER_STATUS_LABEL[current.status]}</Badge>
        </div>
        <p className="mt-2 text-brown">
          {KIND_LABEL[current.kind]}: {categoryLabel(current.kind, current.category)}
          {current.reference ? <> · about {current.reference}</> : null}
        </p>
        <dl className="mt-5 grid max-w-[34rem] grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-[15px]">
          <dt className="font-semibold text-cocoa">Received</dt>
          <dd>{when(current.createdAt)}</dd>
          {current.ackedAt ? (
            <>
              <dt className="font-semibold text-cocoa">Acknowledged</dt>
              <dd>{when(current.ackedAt)}</dd>
            </>
          ) : null}
          {open ? (
            <>
              <dt className="font-semibold text-cocoa">We aim to resolve by</dt>
              <dd>{day(current.resolveBy)}</dd>
            </>
          ) : null}
          {current.resolvedAt ? (
            <>
              <dt className="font-semibold text-cocoa">Resolved</dt>
              <dd>{when(current.resolvedAt)}</dd>
            </>
          ) : null}
        </dl>
        {current.resolutionNote ? (
          <p className="mt-5 max-w-[60ch] rounded-[10px] bg-ok-wash px-4 py-3 text-ok">
            <strong className="font-semibold">What we did:</strong> {current.resolutionNote}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="thread-h">
        <h2 id="thread-h" className="font-display mb-4 text-[clamp(1.75rem,3.6vw,2.25rem)]">
          Conversation
        </h2>
        <ol className="space-y-4">
          {current.messages.map((m) => (
            <li key={m.id} className={m.author === "customer" ? "max-w-[46rem]" : "max-w-[46rem] sm:ml-10"}>
              <div className={m.author === "customer" ? "rounded-ticket bg-kraft-light px-5 py-4" : "rounded-ticket bg-paper px-5 py-4 shadow-ticket"}>
                <p className="font-stencil text-[12px] text-brown">
                  {m.author === "customer" ? "You" : "FuzzBall Factory"} · {when(m.at)}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-cocoa">{m.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {current.status === "CLOSED" ? (
        <p className="max-w-[60ch] text-brown">This request is closed. If you still need help, start a new one from the contact page.</p>
      ) : (
        <form onSubmit={submit} className="max-w-[46rem] space-y-4" noValidate>
          <Field label="Your reply" hint={current.status === "RESOLVED" ? "Replying reopens this request." : undefined} error={error}>
            {(p) => <Textarea {...p} rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} />}
          </Field>
          <Button type="submit" disabled={sending} aria-busy={sending}>
            <Send aria-hidden strokeWidth={1.8} />
            {sending ? "Sending…" : "Send reply"}
          </Button>
        </form>
      )}
    </div>
  );
}
