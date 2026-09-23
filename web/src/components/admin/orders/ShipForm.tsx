"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Spinner } from "./Spinner";

export const COURIERS = ["Delhivery", "India Post", "DTDC", "Blue Dart", "Shiprocket", "DHL"];

interface Props {
  busy: boolean;
  submitLabel: string;
  busyLabel: string;
  /** Field errors from the API (`awb`, `courier`). */
  fieldErrors?: Record<string, string>;
  initial?: { courier?: string; awb?: string };
  onSubmit: (courier: string, awb: string) => void | Promise<void>;
  onCancel: () => void;
}

/** Courier + AWB capture, shared by orders and work orders. Moves focus to the first field when it opens. */
export function ShipForm({ busy, submitLabel, busyLabel, fieldErrors, initial, onSubmit, onCancel }: Props) {
  const first = useRef<HTMLInputElement>(null);
  const [courier, setCourier] = useState(initial?.courier ?? "");
  const [awb, setAwb] = useState(initial?.awb ?? "");
  const [local, setLocal] = useState<Record<string, string>>({});

  useEffect(() => { first.current?.focus(); }, []);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const errs: Record<string, string> = {};
    if (!courier.trim()) errs.courier = "Add the courier name.";
    if (!awb.trim()) errs.awb = "Add the AWB (tracking) number.";
    setLocal(errs);
    if (Object.keys(errs).length) return;
    void onSubmit(courier.trim(), awb.trim());
  }

  const list = "couriers-list";
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <Field label="Courier" error={local.courier ?? fieldErrors?.courier}>
        {(p) => (
          <>
            <Input {...p} ref={first} list={list} value={courier} onChange={(e) => setCourier(e.target.value)} placeholder="e.g. Delhivery" autoComplete="off" />
            <datalist id={list}>{COURIERS.map((c) => <option key={c} value={c} />)}</datalist>
          </>
        )}
      </Field>
      <Field label="AWB number" error={local.awb ?? (fieldErrors?.awb === "Required" ? "Add the AWB (tracking) number." : fieldErrors?.awb)}>
        {(p) => <Input {...p} value={awb} onChange={(e) => setAwb(e.target.value)} className="font-stencil tracking-[0.05em]" autoComplete="off" autoCapitalize="characters" />}
      </Field>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="submit" disabled={busy}>{busy ? <><Spinner /> {busyLabel}</> : submitLabel}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>Not yet</Button>
      </div>
    </form>
  );
}
