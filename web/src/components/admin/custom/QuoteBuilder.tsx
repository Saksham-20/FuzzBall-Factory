"use client";

import { useEffect, useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Send, X } from "lucide-react";
import { Panel } from "@/components/admin/ui";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ErrorNote, Skeleton } from "@/components/ui/misc";
import { sendQuote } from "@/lib/api/admin";
import { balanceAmount, depositAmount } from "@/lib/api/custom";
import { getSettings } from "@/lib/api/settings";
import { useApi } from "@/lib/api/useApi";
import { formatDate, formatINR } from "@/lib/format";
import { ApiError } from "@/lib/mock/db";
import type { CustomRequest, StoreSettings } from "@/lib/types";
import { Spinner } from "../orders/Spinner";
import { firstName } from "../orders/wa";
import { budgetLabel } from "./workflow";

// PLACEHOLDER(hourly-rate): sample crochet rate in rupees per hour for the calculator. The maker sets the real one; it will move to Settings.
const DEFAULT_HOURLY_RATE = 150;

const schema = z.object({
  lines: z
    .array(
      z.object({
        label: z.string().trim().min(1, "Name this line"),
        amount: z.number({ error: "Enter an amount" }).int("Whole rupees only").positive("More than ₹0"),
      }),
    )
    .min(1, "Add at least one priced line")
    .max(12, "Twelve lines is plenty. Merge a few."),
  timelineDays: z.number({ error: "Enter a number of days" }).int("Whole days").min(1, "At least 1 day").max(120, "Keep it under 120 days"),
  revisions: z.number({ error: "Choose a number" }).int().min(0).max(5),
  scope: z.string().trim().min(10, "Say what's included so nobody is surprised later"),
  validDays: z.number({ error: "Enter a number of days" }).int("Whole days").min(1, "At least 1 day").max(30, "Keep it under 30 days"),
});
type Values = z.infer<typeof schema>;

const defaultScope = (r: CustomRequest) =>
  `${r.quantity > 1 ? `${r.quantity} pieces` : "One piece"} as described in the work order. Includes one round of changes to colour or small details before the final photos. Extra changes are quoted separately. Original design only.`;

/** Quote builder. Waits for settings (deposit %, default validity) before showing the form. */
export function QuoteBuilder({ request, onSent, focusOnOpen }: { request: CustomRequest; onSent: (r: CustomRequest) => void; focusOnOpen?: boolean }) {
  const settings = useApi(getSettings, "settings");
  return (
    <Panel title="Quote builder">
      <div id="quote-builder">
        {settings.error && !settings.data ? (
          <ErrorNote onRetry={settings.reload}>We couldn&apos;t load your deposit settings, so the quote can&apos;t be split yet.</ErrorNote>
        ) : !settings.data ? (
          <div role="status" aria-label="Loading quote builder" className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <BuilderForm request={request} settings={settings.data} onSent={onSent} focusOnOpen={focusOnOpen} />
        )}
      </div>
    </Panel>
  );
}

function BuilderForm({ request: r, settings, onSent, focusOnOpen }: { request: CustomRequest; settings: StoreSettings; onSent: (r: CustomRequest) => void; focusOnOpen?: boolean }) {
  // When the maker asked for the builder (after a counter, or "Write a quote"), put the cursor in the first line.
  useEffect(() => {
    if (focusOnOpen) document.querySelector<HTMLInputElement>("#quote-builder input")?.focus({ preventScroll: true });
  }, [focusOnOpen]);

  // Start from the last quote when re-quoting after a counter or an expiry.
  const last = [...r.quotes].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).at(-1);
  const counter = r.quotes.find((q) => q.status === "COUNTERED" && q.counter);

  const { register, control, handleSubmit, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      lines: last?.breakdown.length ? last.breakdown.map((l) => ({ ...l })) : [{ label: "Materials (yarn, stuffing, eyes)", amount: undefined as unknown as number }],
      timelineDays: last?.timelineDays ?? 7,
      revisions: last?.revisions ?? 1,
      scope: last?.scope ?? defaultScope(r),
      validDays: settings.quoteValidityDays,
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" });
  const validDays = useWatch({ control, name: "validDays" });

  const [now] = useState(() => Date.now());
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState(String(DEFAULT_HOURLY_RATE));
  const [calcError, setCalcError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const subtotal = lines.reduce((s, l) => s + (Number.isFinite(l?.amount) ? l.amount : 0), 0);
  const split = { price: subtotal, depositPct: settings.depositPct };
  const validUntil = Number.isFinite(validDays) && validDays > 0 ? new Date(now + validDays * 864e5) : undefined;

  const addLine = (label: string, amount?: number) =>
    append({ label, amount: amount as number }, { focusName: amount === undefined ? `lines.${fields.length}.amount` : undefined });

  function addHours() {
    const h = Number(hours);
    const rt = Number(rate);
    if (!(h > 0) || !(rt > 0)) {
      setCalcError("Enter both hours and a rate above 0.");
      return;
    }
    setCalcError(undefined);
    addLine(`Crochet time (${h} ${h === 1 ? "hr" : "hrs"} × ${formatINR(rt)})`, Math.round(h * rt));
    setHours("");
  }

  async function submit(v: Values) {
    setError(undefined);
    setBusy(true);
    try {
      const updated = await sendQuote(r.number, { breakdown: v.lines.map((l) => ({ label: l.label, amount: l.amount })), timelineDays: v.timelineDays, revisions: v.revisions, scope: v.scope, validDays: v.validDays });
      toast.success(`Quote sent to ${firstName(r.customerName)}.`);
      onSent(updated);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "The quote didn't send. Check your connection and try again.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  const over = subtotal > r.budgetMax ? subtotal - r.budgetMax : 0;
  const under = subtotal > 0 && subtotal < r.budgetMin ? r.budgetMin - subtotal : 0;

  return (
    <form onSubmit={handleSubmit(submit)} noValidate className="space-y-6">
      <div className="space-y-1 text-[15px]">
        <p><span className="text-brown">Their budget: </span><span className="tabular font-semibold">{budgetLabel(r)}</span></p>
        {counter?.counter ? (
          <p>
            <span className="text-brown">They countered at </span><span className="tabular font-semibold">{formatINR(counter.counter.amount)}</span>
            <span className="text-brown"> (you quoted </span><span className="tabular">{formatINR(counter.price)}</span><span className="text-brown">).</span>
          </p>
        ) : null}
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-semibold">What the price is made of</legend>
        <ul className="space-y-3">
          {fields.map((f, i) => {
            const e = errors.lines?.[i];
            return (
              <li key={f.id} className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 sm:grid-cols-[1fr_10rem_auto]">
                <div className="col-span-2 sm:col-span-1">
                  <Input aria-label={`Line ${i + 1} name`} aria-invalid={e?.label ? true : undefined} placeholder="What it covers" {...register(`lines.${i}.label`)} />
                  {e?.label ? <p role="alert" className="mt-1 text-sm font-medium text-err">{e.label.message}</p> : null}
                </div>
                <div>
                  <div className="relative">
                    <span aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-brown-soft">₹</span>
                    <Input type="number" inputMode="numeric" min={1} step={1} aria-label={`Line ${i + 1} amount in rupees`} aria-invalid={e?.amount ? true : undefined} placeholder="0" className="tabular pl-8" {...register(`lines.${i}.amount`, { valueAsNumber: true })} />
                  </div>
                  {e?.amount ? <p role="alert" className="mt-1 text-sm font-medium text-err">{e.amount.message}</p> : null}
                </div>
                <Button type="button" variant="ghost" aria-label={`Remove line ${i + 1}`} className="size-12 shrink-0 px-0" onClick={() => remove(i)} disabled={fields.length === 1}>
                  <X strokeWidth={1.8} />
                </Button>
              </li>
            );
          })}
        </ul>
        {errors.lines?.root?.message || (errors.lines as { message?: string } | undefined)?.message ? (
          <p role="alert" className="text-sm font-medium text-err">{errors.lines?.root?.message ?? (errors.lines as { message?: string }).message}</p>
        ) : null}

        <div role="group" aria-label="Add a line" className="flex flex-wrap gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={() => addLine("Materials (yarn, stuffing, eyes)")}><Plus strokeWidth={1.8} /> Materials</Button>
          <Button type="button" variant="secondary" onClick={() => addLine("Design fee")}><Plus strokeWidth={1.8} /> Design fee</Button>
          <Button type="button" variant="secondary" onClick={() => addLine("Packaging")}><Plus strokeWidth={1.8} /> Packaging</Button>
          <Button type="button" variant="ghost" onClick={() => addLine("")}><Plus strokeWidth={1.8} /> Other line</Button>
        </div>

        <div className="rounded-[12px] bg-kraft-light/60 p-3">
          <p className="mb-2 text-sm font-semibold">Crochet time: hours × rate</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs text-brown">Hours</span>
              <Input type="number" inputMode="decimal" min={0} step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} className="tabular w-24" />
            </label>
            <label className="relative block" data-placeholder="hourly-rate">
              <span className="mb-1 block text-xs text-brown">Rate per hour (₹)</span>
              <Input type="number" inputMode="numeric" min={0} step={10} value={rate} onChange={(e) => setRate(e.target.value)} className="tabular w-32" />
            </label>
            <Button type="button" variant="secondary" onClick={addHours}><Plus strokeWidth={1.8} /> Add crochet time</Button>
          </div>
          {calcError ? <p role="alert" className="mt-1.5 text-sm font-medium text-err">{calcError}</p> : null}
        </div>
      </fieldset>

      <dl className="space-y-1.5 rounded-[12px] bg-cream p-4 text-[15px]" aria-live="polite">
        <div className="flex justify-between gap-4 text-lg font-bold"><dt>Quote total</dt><dd className="tabular">{formatINR(subtotal)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-brown">Deposit to start ({settings.depositPct}%)</dt><dd className="tabular">{formatINR(depositAmount(split))}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-brown">Balance before shipping</dt><dd className="tabular">{formatINR(balanceAmount(split))}</dd></div>
        {over ? <p className="pt-1 text-sm font-semibold text-warn">{formatINR(over)} over their top budget.</p> : null}
        {under ? <p className="pt-1 text-sm text-brown">{formatINR(under)} under their lowest budget.</p> : null}
        {subtotal > 0 && !over && !under ? <p className="pt-1 text-sm text-brown">Within their budget.</p> : null}
      </dl>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Days to make" error={errors.timelineDays?.message}>
          {(p) => <Input {...p} type="number" inputMode="numeric" min={1} className="tabular" {...register("timelineDays", { valueAsNumber: true })} />}
        </Field>
        <Field label="Revisions included" error={errors.revisions?.message}>
          {(p) => (
            <Select {...p} {...register("revisions", { valueAsNumber: true })}>
              {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n === 0 ? "None" : n === 1 ? "1 round" : `${n} rounds`}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Quote valid for (days)" error={errors.validDays?.message} hint={validUntil ? `Until ${formatDate(validUntil)}` : undefined}>
          {(p) => <Input {...p} type="number" inputMode="numeric" min={1} className="tabular" {...register("validDays", { valueAsNumber: true })} />}
        </Field>
      </div>

      <Field label="What's included" error={errors.scope?.message} hint="The customer reads this before they accept.">
        {(p) => <Textarea {...p} rows={4} {...register("scope")} />}
      </Field>

      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Button type="submit" size="lg" disabled={busy} aria-busy={busy} className="w-full sm:w-auto">
        {busy ? <><Spinner /> Sending quote…</> : <><Send strokeWidth={1.8} /> Send quote to {firstName(r.customerName)}</>}
      </Button>
    </form>
  );
}
