"use client";

import { useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { ErrorNote } from "@/components/ui/misc";
import { adminMessage } from "@/lib/api/admin";
import { formatDate } from "@/lib/format";
import { ApiError } from "@/lib/mock/db";
import { cn } from "@/lib/cn";
import type { CustomRequest } from "@/lib/types";
import { firstName } from "../orders/wa";
import { Spinner } from "../orders/Spinner";

export const COMPOSER_ID = "wo-composer";

/** Message thread with the customer, plus the composer. */
export function Thread({ request: r, onUpdated }: { request: CustomRequest; onUpdated: (r: CustomRequest) => void }) {
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();

  async function send() {
    if (busy) return;
    if (!body.trim()) {
      setFieldError(`Write a message to ${firstName(r.customerName)} first.`);
      return;
    }
    setFieldError(undefined);
    setError(undefined);
    setBusy(true);
    try {
      const updated = await adminMessage(r.number, body.trim(), photos.length ? photos : undefined);
      onUpdated(updated);
      setBody("");
      setPhotos([]);
      toast.success("Message sent.");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "The message didn't send. Check your connection and try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); }
  };

  return (
    <Panel title="Messages">
      {r.messages.length === 0 ? (
        <p className="mb-4 text-brown">No messages yet. Say hello, or send the quote and it will show up here.</p>
      ) : (
        <ol aria-label="Messages, oldest first" className="mb-5 space-y-4">
          {r.messages.map((m) => {
            const mine = m.author === "maker";
            return (
              <li key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                <p className="mb-1 text-xs text-brown-soft">
                  <span className="font-semibold">{mine ? "You" : firstName(r.customerName)}</span> · <span className="tabular">{formatDate(m.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
                </p>
                <div className={cn("max-w-[min(100%,52ch)] rounded-[14px] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-line", mine ? "bg-cocoa text-cream" : "bg-kraft-light")}>
                  {m.body}
                  {m.attachments?.length ? (
                    <span className="mt-2 flex flex-wrap gap-2">
                      {m.attachments.map((src, i) => (
                        <a key={i} href={src} target="_blank" rel="noopener noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`Attachment ${i + 1}`} className="size-24 rounded-[10px] object-cover" />
                        </a>
                      ))}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div id={COMPOSER_ID} className="space-y-3">
        <Field label={`Message ${firstName(r.customerName)}`} error={fieldError} hint="The customer sees this on their work order page. Ctrl or Cmd + Enter sends.">
          {(p) => <Textarea {...p} value={body} onChange={(e) => { setBody(e.target.value); if (fieldError) setFieldError(undefined); }} onKeyDown={onKey} rows={3} />}
        </Field>
        <ImageUploader label="Attach photos" hint="Optional." value={photos} onChange={setPhotos} max={3} />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button onClick={() => void send()} disabled={busy} aria-busy={busy}>
          {busy ? <><Spinner /> Sending…</> : <><Send strokeWidth={1.8} /> Send message</>}
        </Button>
      </div>
    </Panel>
  );
}
