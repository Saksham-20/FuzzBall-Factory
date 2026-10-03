"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Lock, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, Panel } from "@/components/admin/ui";
import { SlaCell, STATUS_TONE } from "@/components/admin/support/sla";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import {
  acknowledgeTicket,
  getAdminTicket,
  patchAdminTicket,
  reopenTicket,
  replyAdminTicket,
  resolveTicket,
} from "@/lib/api/admin-support";
import { ApiError } from "@/lib/api/errors";
import { useApi } from "@/lib/api/useApi";
import { formatDate } from "@/lib/format";
import { CATEGORIES, CHANNEL_LABEL, KIND_LABEL, STATUS_LABEL, categoryLabel, isOpen } from "@/lib/support";
import type { AdminTicket } from "@/lib/types";

const when = (iso: string) => formatDate(iso, { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
const resolveFormId = "resolve-ticket-form";

export function SupportDetailClient({ id }: { id: string }) {
  const { data, error, loading, reload, setData } = useApi(() => getAdminTicket(id), `admin-ticket:${id}`);

  return (
    <div>
      <Link href="/admin/support" className="mb-4 inline-flex min-h-11 items-center gap-1.5 font-semibold text-cocoa underline">
        <ArrowLeft aria-hidden className="size-4" /> All requests
      </Link>
      {loading && !data ? (
        <div className="space-y-4" aria-label="Loading the request">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-48" />
        </div>
      ) : error ? (
        error instanceof ApiError && error.status === 404 ? (
          <EmptyState title="That request doesn't exist">It may have been deleted after the retention period.</EmptyState>
        ) : (
          <ErrorNote onRetry={reload}>{error.message}</ErrorNote>
        )
      ) : data ? (
        <Detail ticket={data} onChange={setData} />
      ) : null}
    </div>
  );
}

function Detail({ ticket: t, onChange }: { ticket: AdminTicket; onChange: (t: AdminTicket) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

  async function run(label: string, work: () => Promise<AdminTicket>, success: string) {
    setBusy(label);
    try {
      onChange(await work());
      toast.success(success);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That didn't work. Try again.");
    } finally {
      setBusy(null);
    }
  }

  const open = isOpen(t.status);

  return (
    <AdminPage
      title={
        <span className="flex flex-wrap items-center gap-3">
          {t.number}
          <Badge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</Badge>
        </span>
      }
      actions={
        <>
          {open ? (
            <Button onClick={() => setResolving(true)}>
              <CheckCircle2 aria-hidden strokeWidth={1.8} />
              Resolve
            </Button>
          ) : (
            <Button variant="secondary" disabled={busy === "reopen"} onClick={() => run("reopen", () => reopenTicket(t.id), "Reopened.")}>
              <RotateCcw aria-hidden strokeWidth={1.8} />
              Reopen
            </Button>
          )}
          {t.status !== "CLOSED" ? (
            <Button variant="ghost" disabled={busy === "close"} onClick={() => run("close", () => patchAdminTicket(t.id, { status: "CLOSED" }), "Closed.")}>
              Close
            </Button>
          ) : null}
        </>
      }
    >
      <p className="text-brown">
        {KIND_LABEL[t.kind]} · {categoryLabel(t.kind, t.category)} · came in by {CHANNEL_LABEL[t.channel].toLowerCase()}
      </p>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Panel title="Conversation">
            <ol className="space-y-3">
              {t.messages.map((m) => (
                <li key={m.id}>
                  <div
                    className={
                      m.author === "internal"
                        ? "rounded-[12px] border border-dashed border-brown-soft bg-butter/20 px-4 py-3"
                        : m.author === "maker"
                          ? "rounded-[12px] bg-kraft-light px-4 py-3 sm:ml-8"
                          : "rounded-[12px] bg-cream px-4 py-3 shadow-ticket"
                    }
                  >
                    <p className="font-stencil flex items-center gap-1.5 text-[11px] text-brown">
                      {m.author === "internal" ? (
                        <>
                          <Lock aria-hidden className="size-3" /> Private note (not sent)
                        </>
                      ) : m.author === "maker" ? (
                        "You replied"
                      ) : (
                        t.name
                      )}{" "}
                      · {when(m.at)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-cocoa">{m.body}</p>
                    {m.attachments.length > 0 ? (
                      <p className="mt-2 flex flex-wrap gap-2 text-sm">
                        {m.attachments.map((a, i) => (
                          <a key={a} href={a} target="_blank" rel="noopener noreferrer" className="underline">
                            Photo {i + 1}
                          </a>
                        ))}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
          {t.status !== "CLOSED" ? <ReplyBox ticket={t} onChange={onChange} /> : <p className="text-brown">Closed. Reopen it to reply.</p>}
        </div>

        <div className="space-y-4">
          <Panel title="Customer">
            <dl className="space-y-2 text-[15px]">
              <div>
                <dt className="font-stencil text-[11px] text-brown-soft">Name</dt>
                <dd className="font-semibold">{t.name}</dd>
              </div>
              <div>
                <dt className="font-stencil text-[11px] text-brown-soft">Email</dt>
                <dd className="break-all">{t.email ? <a className="underline" href={`mailto:${t.email}`}>{t.email}</a> : <span className="text-brown-soft">None given</span>}</dd>
              </div>
              {t.phone ? (
                <div>
                  <dt className="font-stencil text-[11px] text-brown-soft">Phone</dt>
                  <dd>
                    <a className="underline" href={`tel:${t.phone}`}>{t.phone}</a>
                  </dd>
                </div>
              ) : null}
              {t.orderNumber ? (
                <div>
                  <dt className="font-stencil text-[11px] text-brown-soft">Order</dt>
                  <dd>
                    <Link className="underline" href={`/admin/orders/${t.orderNumber}`}>{t.orderNumber}</Link>
                  </dd>
                </div>
              ) : null}
              {t.workOrderNumber ? (
                <div>
                  <dt className="font-stencil text-[11px] text-brown-soft">Work order</dt>
                  <dd>
                    <Link className="underline" href={`/admin/custom/${encodeURIComponent(t.workOrderNumber)}`}>{t.workOrderNumber}</Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </Panel>

          <Panel title="Clocks">
            <dl className="space-y-3 text-[15px]">
              <div>
                <dt className="font-stencil text-[11px] text-brown-soft">Received</dt>
                <dd>{when(t.createdAt)}</dd>
              </div>
              <div>
                <dt className="font-stencil text-[11px] text-brown-soft">Acknowledge by {when(t.ackDueAt)}</dt>
                <dd className="mt-1 flex flex-wrap items-center gap-2">
                  <SlaCell state={t.sla.ack} ms={t.sla.ackMs} doneLabel={t.ackedAt ? `Done ${when(t.ackedAt)}` : "Done"} />
                  {!t.ackedAt && open ? (
                    <Button size="sm" variant="secondary" disabled={busy === "ack"} onClick={() => run("ack", () => acknowledgeTicket(t.id), "Marked as acknowledged.")}>
                      I answered them
                    </Button>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt className="font-stencil text-[11px] text-brown-soft">Resolve by {when(t.resolveDueAt)}</dt>
                <dd className="mt-1">
                  <SlaCell state={t.sla.resolve} ms={t.sla.resolveMs} doneLabel={t.resolvedAt ? `Done ${when(t.resolvedAt)}` : "Done"} />
                </dd>
              </div>
              {t.recordCopySentAt ? (
                <div>
                  <dt className="font-stencil text-[11px] text-brown-soft">Copy of the complaint sent</dt>
                  <dd>{when(t.recordCopySentAt)}</dd>
                </div>
              ) : null}
            </dl>
            {t.resolutionNote ? <p className="mt-4 rounded-[10px] bg-ok-wash px-3 py-2 text-sm text-ok"><strong className="font-semibold">Resolution:</strong> {t.resolutionNote}</p> : null}
          </Panel>

          <Panel title="Details">
            <div className="space-y-4">
              <Field label="Topic">
                {(p) => (
                  <Select {...p} value={t.category} disabled={busy === "category"} onChange={(e) => run("category", () => patchAdminTicket(t.id, { category: e.target.value }), "Topic changed.")}>
                    {CATEGORIES[t.kind].map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <LinkOrder ticket={t} onSave={(ref) => run("link", () => patchAdminTicket(t.id, { reference: ref }), ref ? "Linked." : "Unlinked.")} busy={busy === "link"} />
              <p className="text-sm text-brown-soft">
                Every change here is written to the <Link className="underline" href="/admin/audit">audit log</Link>.
              </p>
            </div>
          </Panel>
        </div>
      </div>

      <ResolveModal
        open={resolving}
        onOpenChange={setResolving}
        canEmail={!!t.email}
        onResolve={async (note, notify) => {
          const next = await resolveTicket(t.id, { note, notify });
          onChange(next);
          toast.success(notify && t.email ? "Resolved. The customer has been emailed." : "Resolved.");
        }}
      />
    </AdminPage>
  );
}

function LinkOrder({ ticket, onSave, busy }: { ticket: AdminTicket; onSave: (ref: string) => void; busy: boolean }) {
  const [ref, setRef] = useState(ticket.orderNumber ?? ticket.workOrderNumber ?? "");
  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(ref.trim());
      }}
    >
      <div className="min-w-0 flex-1">
        <Field label="Order or work order" optional hint="Like FB-1001 or WO-001. Empty unlinks.">
          {(p) => <Input {...p} value={ref} onChange={(e) => setRef(e.target.value)} autoComplete="off" />}
        </Field>
      </div>
      <Button type="submit" variant="secondary" disabled={busy} className="mb-[1.6rem]">
        Link
      </Button>
    </form>
  );
}

function ReplyBox({ ticket, onChange }: { ticket: AdminTicket; onChange: (t: AdminTicket) => void }) {
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const canEmail = !!ticket.email;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!text.trim()) {
      setError("Write something first.");
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      onChange(await replyAdminTicket(ticket.id, { body: text.trim(), internal }));
      setText("");
      toast.success(internal ? "Note saved." : canEmail ? "Sent. The customer has been emailed." : "Saved. They have no email, so tell them yourself.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={internal ? "Private note" : "Reply to the customer"}>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <fieldset className="flex flex-wrap gap-x-5 gap-y-1">
          <legend className="sr-only">What kind of message</legend>
          <label className="flex min-h-11 items-center gap-2 font-semibold">
            <input type="radio" name="reply-kind" checked={!internal} onChange={() => setInternal(false)} /> Reply (emailed)
          </label>
          <label className="flex min-h-11 items-center gap-2 font-semibold">
            <input type="radio" name="reply-kind" checked={internal} onChange={() => setInternal(true)} /> Private note
          </label>
        </fieldset>
        <Field label={internal ? "Note" : "Your reply"} hint={internal ? "Only you see this." : canEmail ? "They get this by email, with a link to answer." : "This customer has no email on file. Answer them on the channel they used."} error={error}>
          {(p) => <Textarea {...p} rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={3000} />}
        </Field>
        <Button type="submit" disabled={busy} aria-busy={busy}>
          {internal ? <Lock aria-hidden strokeWidth={1.8} /> : <Send aria-hidden strokeWidth={1.8} />}
          {busy ? "Saving…" : internal ? "Save note" : "Send reply"}
        </Button>
      </form>
    </Panel>
  );
}

function ResolveModal({ open, onOpenChange, canEmail, onResolve }: { open: boolean; onOpenChange: (o: boolean) => void; canEmail: boolean; onResolve: (note: string, notify: boolean) => Promise<void> }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Resolve this request"
      description="Say what was done. It is kept in the register and sent to the customer."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Keep open
          </Button>
          <Button type="submit" form={resolveFormId}>
            Resolve
          </Button>
        </>
      }
    >
      <ResolveForm canEmail={canEmail} onDone={() => onOpenChange(false)} onResolve={onResolve} />
    </Modal>
  );
}

function ResolveForm({ canEmail, onResolve, onDone }: { canEmail: boolean; onResolve: (note: string, notify: boolean) => Promise<void>; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [notify, setNotify] = useState(canEmail);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (note.trim().length < 3) {
      setError("Say what was done, in a few words.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onResolve(note.trim(), notify && canEmail);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't resolve that.");
      setBusy(false);
    }
  }

  return (
    <form id={resolveFormId} onSubmit={submit} className="space-y-4" noValidate>
      <Field label="What was done" error={error}>
        {(p) => <Textarea {...p} rows={4} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1500} />}
      </Field>
      <Checkbox label={canEmail ? "Email this to the customer" : "No email on file: tell them yourself"} checked={notify && canEmail} disabled={!canEmail} onChange={(e) => setNotify(e.target.checked)} />
    </form>
  );
}
