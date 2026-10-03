"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/misc";
import { ApiError } from "@/lib/api/errors";
import { logTicket } from "@/lib/api/admin-support";
import { CATEGORIES, CHANNEL_LABEL, KIND_LABEL, TICKET_CHANNELS, TICKET_KINDS } from "@/lib/support";
import type { AdminTicket, TicketChannel, TicketKind } from "@/lib/types";

const formId = "log-ticket-form";

/** `datetime-local` value for "now" in the maker's own time. */
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/**
 * Write down a request that did not come through the website: a WhatsApp chat, a phone call, a letter. Each complaint
 * must be in the register, and its clocks start from when the customer actually wrote, which is why the date is here.
 */
export function LogTicketModal({ open, onOpenChange, onLogged }: { open: boolean; onOpenChange: (o: boolean) => void; onLogged: (t: AdminTicket) => void }) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Log a request"
      description="For a message or complaint that reached you on WhatsApp, by phone or by post. It goes into the same register."
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form={formId}>
            Log it
          </Button>
        </>
      }
    >
      <LogForm onLogged={(t) => { onOpenChange(false); onLogged(t); }} />
    </Modal>
  );
}

/** Mounted fresh each time the dialog opens, so every field starts empty. */
function LogForm({ onLogged }: { onLogged: (t: AdminTicket) => void }) {
  const [kind, setKind] = useState<TicketKind>("GRIEVANCE");
  const [channel, setChannel] = useState<TicketChannel>("WHATSAPP");
  const [category, setCategory] = useState(CATEGORIES.GRIEVANCE[0].value);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [receivedAt, setReceivedAt] = useState(nowLocal);
  const [answered, setAnswered] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(undefined);
    setFields({});
    try {
      const t = await logTicket({
        kind,
        channel,
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        category,
        reference: reference.trim() || undefined,
        message: message.trim(),
        receivedAt: receivedAt ? new Date(receivedAt).toISOString() : undefined,
        alreadyAcknowledged: answered,
      });
      toast.success(`Logged as ${t.number}.`);
      onLogged(t);
    } catch (err) {
      if (err instanceof ApiError && err.fields) setFields(err.fields);
      setError(err instanceof Error ? err.message : "Couldn't log that.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kind" error={fields.kind}>
          {(p) => (
            <Select
              {...p}
              value={kind}
              onChange={(e) => {
                const k = e.target.value as TicketKind;
                setKind(k);
                setCategory(CATEGORIES[k][0].value);
              }}
            >
              {TICKET_KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Came in by" error={fields.channel}>
          {(p) => (
            <Select {...p} value={channel} onChange={(e) => setChannel(e.target.value as TicketChannel)}>
              {TICKET_CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {CHANNEL_LABEL[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer name" error={fields.name}>
          {(p) => <Input {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />}
        </Field>
        <Field label="Topic" error={fields.category}>
          {(p) => (
            <Select {...p} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES[kind].map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" optional hint="Needed to send them a copy and our replies." error={fields.email}>
          {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />}
        </Field>
        <Field label="Phone" optional error={fields.phone}>
          {(p) => <Input {...p} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />}
        </Field>
      </div>
      <Field label="Order or work-order number" optional hint="Like FB-1001 or WO-001." error={fields.reference}>
        {(p) => <Input {...p} value={reference} onChange={(e) => setReference(e.target.value)} autoComplete="off" />}
      </Field>
      <Field label="What they said" hint="As close to their own words as you can." error={fields.message}>
        {(p) => <Textarea {...p} rows={5} value={message} onChange={(e) => setMessage(e.target.value)} />}
      </Field>
      <Field label="When they wrote" hint="Their 48 hour and one month clocks start from here." error={fields.receivedAt}>
        {(p) => <Input {...p} type="datetime-local" value={receivedAt} max={nowLocal()} onChange={(e) => setReceivedAt(e.target.value)} />}
      </Field>
      <Checkbox label="I have already answered them on that channel (no email is sent)" checked={answered} onChange={(e) => setAnswered(e.target.checked)} />
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </form>
  );
}
