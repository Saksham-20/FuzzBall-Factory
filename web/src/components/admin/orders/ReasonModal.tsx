"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { Field, Textarea } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

export interface ReasonTemplate {
  /** Short chip label. */
  label: string;
  /** Text dropped into the box. Defaults to the label. */
  text?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  templates: ReasonTemplate[];
  /** Pre-picked template label (e.g. when opened from the licensed-character hint). */
  initial?: string;
  fieldLabel?: string;
  confirmLabel: string;
  busyLabel: string;
  busy: boolean;
  error?: string | null;
  /** Red confirm button for destructive actions. */
  danger?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}

const formId = "reason-form";

/** Reason capture for cancel / refund / decline: template chips + a free-text box. Focus is trapped by the Radix dialog. */
export function ReasonModal({ open, onOpenChange, title, description, confirmLabel, busyLabel, busy, danger, ...rest }: Props) {
  return (
    <Modal
      open={open}
      onOpenChange={(v) => { if (!busy) onOpenChange(v); }}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" type="button" disabled={busy} onClick={() => onOpenChange(false)}>Keep as is</Button>
          <Button
            type="submit"
            form={formId}
            disabled={busy}
            className={cn(danger && "bg-err text-cream [@media(hover:hover)_and_(pointer:fine)]:hover:bg-err/90")}
          >
            {busy ? <><Spinner /> {busyLabel}</> : confirmLabel}
          </Button>
        </>
      }
    >
      <ReasonForm busy={busy} {...rest} />
    </Modal>
  );
}

/** Mounted fresh each time the dialog opens, so its text state resets by itself. */
function ReasonForm({ templates, initial, fieldLabel = "Reason", error, busy, onConfirm }: Pick<Props, "templates" | "initial" | "fieldLabel" | "error" | "onConfirm" | "busy">) {
  const start = templates.find((t) => t.label === initial);
  const [text, setText] = useState(start ? (start.text ?? start.label) : "");
  const [localError, setLocalError] = useState<string>();

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (text.trim().length < 3) {
      setLocalError("Add a short reason so the timeline makes sense.");
      return;
    }
    setLocalError(undefined);
    void onConfirm(text.trim());
  }

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <div role="group" aria-label="Quick reasons" className="flex flex-wrap gap-2">
        {templates.map((t) => {
          const value = t.text ?? t.label;
          const on = text === value;
          return (
            <button
              key={t.label}
              type="button"
              aria-pressed={on}
              onClick={() => { setText(value); setLocalError(undefined); }}
              className={cn(
                "press min-h-11 rounded-full px-4 text-left text-sm font-semibold transition-colors duration-150",
                on ? "bg-cocoa text-cream" : "bg-kraft-light text-cocoa [@media(hover:hover)_and_(pointer:fine)]:hover:bg-kraft",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <Field label={fieldLabel} error={localError}>
        {(p) => <Textarea {...p} value={text} onChange={(e) => setText(e.target.value)} rows={4} />}
      </Field>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </form>
  );
}
