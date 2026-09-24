"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { addMessage } from "@/lib/api/custom";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { CustomMessage, CustomRequest } from "@/lib/types";
import { errorMessage } from "./helpers";
import { WhatsAppLink } from "./StatusPanels";

interface Pending {
  id: string;
  body: string;
  attachments: string[];
  at: string;
}

export function MessageThread({ r, onChange }: { r: CustomRequest; onChange: (next?: CustomRequest) => void }) {
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const shown: (CustomMessage & { pending?: boolean })[] = [
    ...r.messages,
    ...pending.map((p) => ({ id: p.id, author: "customer" as const, body: p.body, attachments: p.attachments, at: p.at, pending: true })),
  ];

  // Keep the newest message in view.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown.length]);

  const canSend = (draft.trim().length > 0 || files.length > 0) && !sending;

  async function send() {
    if (!canSend) return;
    const body = draft.trim();
    const attachments = files;
    const temp: Pending = { id: `pending-${Date.now()}`, body, attachments, at: new Date().toISOString() };
    // Optimistic: show the bubble and clear the composer straight away.
    setPending((p) => [...p, temp]);
    setDraft("");
    setFiles([]);
    setAttachOpen(false);
    setSending(true);
    try {
      const next = await addMessage(r.number, body || "Photo attached", attachments.length ? attachments : undefined);
      setPending((p) => p.filter((x) => x.id !== temp.id));
      onChange(next);
    } catch (e) {
      // Roll back: drop the bubble and give the customer their text and photos back.
      setPending((p) => p.filter((x) => x.id !== temp.id));
      setDraft(body);
      setFiles(attachments);
      setAttachOpen(attachments.length > 0);
      toast.error(`Message not sent. ${errorMessage(e)}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <Ticket tone="paper" role="region" aria-labelledby="thread-title" head={["Messages", `${r.messages.length}`]}>
      <div className="space-y-4 px-1 pb-2">
        <h2 id="thread-title" className="font-display text-[1.75rem] leading-[1.05]">
          Talk to the maker
        </h2>

        <div ref={scroller} role="log" aria-label="Messages" aria-live="polite" tabIndex={0} data-lenis-prevent className="max-h-[26rem] overflow-y-auto rounded-[12px] bg-cream p-3">
          {shown.length === 0 ? (
            <p className="px-1 py-6 text-center text-[15px] text-brown">No messages yet. Ask a question or add a detail here, or continue on WhatsApp.</p>
          ) : (
            <ul className="space-y-3">
              {shown.map((m) => (
                <Bubble key={m.id} m={m} />
              ))}
            </ul>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="space-y-2"
        >
          <label htmlFor="thread-draft" className="sr-only">
            Your message
          </label>
          <Textarea
            id="thread-draft"
            rows={3}
            value={draft}
            maxLength={1000}
            placeholder="Write a message"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void send();
              }
            }}
          />
          {attachOpen ? <ImageUploader value={files} onChange={setFiles} max={3} label="Photos to send" /> : null}
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setAttachOpen((v) => !v)} aria-expanded={attachOpen}>
              <Paperclip aria-hidden strokeWidth={1.8} />
              {files.length ? `Attach photo (${files.length})` : "Attach photo"}
            </Button>
            <Button type="submit" disabled={!canSend} aria-busy={sending}>
              <SendHorizontal aria-hidden strokeWidth={1.8} />
              {sending ? "Sending…" : "Send message"}
            </Button>
          </div>
        </form>

        <div className="border-t border-line pt-4">
          <WhatsAppLink wo={r.number} />
        </div>
      </div>
    </Ticket>
  );
}

function Bubble({ m }: { m: CustomMessage & { pending?: boolean } }) {
  const mine = m.author === "customer";
  return (
    <li className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
      <p className="mb-1 px-1 text-xs text-brown">
        {mine ? "You" : "FuzzBall Factory"} <span aria-hidden>·</span> <span className="tabular">{m.pending ? "Sending…" : formatDate(m.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</span>
      </p>
      <div className={cn("max-w-[88%] rounded-[14px] px-3.5 py-2.5 text-[15px] leading-relaxed [overflow-wrap:anywhere]", mine ? "rounded-br-[4px] bg-cocoa text-cream [--focus-ring:var(--color-butter)]" : "rounded-bl-[4px] bg-kraft-light text-cocoa", m.pending && "opacity-70")}>
        {m.body ? <p className="whitespace-pre-line">{m.body}</p> : null}
        {m.attachments?.length ? (
          <ul className={cn("flex flex-wrap gap-2", m.body && "mt-2")}>
            {m.attachments.map((src, i) => (
              <li key={i}>
                <a href={src} target="_blank" rel="noopener noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={`Attachment ${i + 1} from ${mine ? "you" : "the maker"}`} loading="lazy" className="size-24 rounded-[10px] object-cover" />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
