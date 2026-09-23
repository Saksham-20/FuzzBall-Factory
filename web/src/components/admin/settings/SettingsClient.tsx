"use client";

import { useMemo, useState } from "react";
import { useFieldArray, useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Info, Plus, Trash2 } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/ui";
import { useUnsavedGuard } from "@/components/admin/catalogue/kit";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input } from "@/components/ui/Field";
import { ErrorNote, Skeleton } from "@/components/ui/misc";
import { useApi } from "@/lib/api/useApi";
import { getAdminSettings, updateSettings } from "@/lib/api/admin";
import { formatINR } from "@/lib/format";
import type { StoreSettings } from "@/lib/types";

const num = (msg: string, o: { min?: number; max?: number; int?: boolean } = {}) =>
  z.string().trim().superRefine((v, ctx) => {
    const n = Number(v);
    if (v === "" || !Number.isFinite(n)) return void ctx.addIssue({ code: "custom", message: msg });
    if (o.int && !Number.isInteger(n)) return void ctx.addIssue({ code: "custom", message: "Use a whole number." });
    if (o.min !== undefined && n < o.min) return void ctx.addIssue({ code: "custom", message: `Must be ${o.min} or more.` });
    if (o.max !== undefined && n > o.max) return void ctx.addIssue({ code: "custom", message: `Must be ${o.max} or less.` });
  });

const schema = z.object({
  whatsapp: z.string().trim().refine((v) => /^\d{10,15}$/.test(v.replace(/[\s+()-]/g, "")), "Enter the number with country code, 10 to 15 digits, like 919876543210."),
  email: z.string().trim().pipe(z.email("Enter a valid email address, like hello@yourshop.com.")),
  domesticShipping: num("Enter a shipping charge in rupees, or 0.", { min: 0 }),
  freeShippingAbove: num("Enter a cart total in rupees.", { min: 1 }),
  intlZones: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Name the zone."),
        countries: z.string().trim().min(1, "List country codes, or * for everywhere else."),
        rate: num("Enter a rate in rupees.", { min: 0 }),
        days: z.string().trim().min(1, "Add a delivery time, like 7–12 days."),
      }),
    )
    .min(1, "Keep at least one international zone, or shoppers abroad can't check out."),
  codEnabled: z.boolean(),
  codCap: num("Enter the largest order that can be cash on delivery.", { min: 0 }),
  codFee: num("Enter a fee in rupees, or 0.", { min: 0 }),
  giftWrapPrice: num("Enter a price in rupees, or 0.", { min: 0 }),
  depositPct: num("Enter a percentage from 1 to 100.", { min: 1, max: 100, int: true }),
  quoteValidityDays: num("Enter a number of days.", { min: 1, max: 60, int: true }),
});
type Values = z.infer<typeof schema>;

const toValues = (s: StoreSettings): Values => ({
  whatsapp: s.whatsapp, email: s.email,
  domesticShipping: String(s.domesticShipping), freeShippingAbove: String(s.freeShippingAbove),
  intlZones: s.intlZones.map((z) => ({ name: z.name, countries: z.countries.join(", "), rate: String(z.rate), days: z.days })),
  codEnabled: s.codEnabled, codCap: String(s.codCap), codFee: String(s.codFee),
  giftWrapPrice: String(s.giftWrapPrice), depositPct: String(s.depositPct), quoteValidityDays: String(s.quoteValidityDays),
});

const toSettings = (v: Values): StoreSettings => ({
  whatsapp: v.whatsapp.replace(/\D/g, ""),
  email: v.email.trim(),
  domesticShipping: Number(v.domesticShipping),
  freeShippingAbove: Number(v.freeShippingAbove),
  intlZones: v.intlZones.map((z) => ({
    name: z.name.trim(),
    countries: z.countries.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean),
    rate: Number(z.rate),
    days: z.days.trim(),
  })),
  codEnabled: v.codEnabled, codCap: Number(v.codCap), codFee: Number(v.codFee),
  giftWrapPrice: Number(v.giftWrapPrice), depositPct: Number(v.depositPct), quoteValidityDays: Number(v.quoteValidityDays),
});

const n = (s: string) => (s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : null);
const money = (s: string) => (n(s) === null ? "…" : formatINR(n(s)!));

/** Plain-language result of the fields above it, so the maker sees what a shopper will see. */
function Effect({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex max-w-[68ch] items-start gap-2 text-[15px] text-brown">
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
      <span><strong className="font-semibold text-cocoa">At checkout: </strong>{children}</span>
    </p>
  );
}

const iconBtn =
  "press grid size-11 shrink-0 place-items-center rounded-full text-brown transition-colors duration-150 disabled:pointer-events-none disabled:opacity-35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/8";

function ZonesEditor({ control, register, errors }: { control: Control<Values>; register: ReturnType<typeof useForm<Values>>["register"]; errors: ReturnType<typeof useForm<Values>>["formState"]["errors"] }) {
  const { fields, append, remove } = useFieldArray({ control, name: "intlZones" });
  const cell = "md:[&>label]:sr-only [&>label]:mb-1 [&>label]:text-xs";
  const rootErr = (errors.intlZones as { root?: { message?: string }; message?: string } | undefined);
  return (
    <div>
      <div aria-hidden className="font-stencil mb-1 hidden gap-3 px-0.5 text-[11px] text-brown-soft md:grid md:grid-cols-[1.3fr_1.6fr_.8fr_1fr_44px]">
        <span>Zone</span><span>Country codes</span><span>Rate (₹)</span><span>Delivery time</span><span />
      </div>
      <ul className="divide-y divide-line">
        {fields.map((f, i) => {
          const e = errors.intlZones?.[i];
          return (
            <li key={f.id} className="grid grid-cols-2 gap-x-3 gap-y-2 py-3 md:grid-cols-[1.3fr_1.6fr_.8fr_1fr_44px] md:items-start">
              <Field label={`Zone ${i + 1} name`} error={e?.name?.message} className={`col-span-2 md:col-span-1 ${cell}`}>
                {(p) => <Input {...p} className="h-11" {...register(`intlZones.${i}.name`)} />}
              </Field>
              <Field label={`Zone ${i + 1} country codes`} error={e?.countries?.message} className={`col-span-2 md:col-span-1 ${cell}`}>
                {(p) => <Input {...p} className="font-stencil h-11" placeholder="GB, DE, FR" autoCapitalize="characters" {...register(`intlZones.${i}.countries`)} />}
              </Field>
              <Field label={`Zone ${i + 1} rate in rupees`} error={e?.rate?.message} className={cell}>
                {(p) => <Input {...p} className="tabular h-11" inputMode="numeric" {...register(`intlZones.${i}.rate`)} />}
              </Field>
              <Field label={`Zone ${i + 1} delivery time`} error={e?.days?.message} className={cell}>
                {(p) => <Input {...p} className="h-11" placeholder="7–12 days" {...register(`intlZones.${i}.days`)} />}
              </Field>
              <div className="col-span-2 flex justify-end md:col-span-1">
                <button type="button" className={iconBtn} aria-label={`Remove zone ${i + 1}`} disabled={fields.length === 1} onClick={() => remove(i)}><Trash2 className="size-[18px]" strokeWidth={1.8} /></button>
              </div>
            </li>
          );
        })}
      </ul>
      {rootErr?.root?.message ?? rootErr?.message ? <p role="alert" className="mt-1 text-sm font-medium text-err">{rootErr?.root?.message ?? rootErr?.message}</p> : null}
      <p className="mt-2 max-w-[68ch] text-sm text-brown">Use two-letter country codes (GB, US, AE) separated by commas. Put <span className="font-stencil text-[12px]">*</span> in one zone to catch every country you haven&apos;t listed.</p>
      <Button type="button" variant="secondary" className="mt-3" onClick={() => append({ name: "", countries: "", rate: "", days: "" })}>
        <Plus strokeWidth={2} /> Add a zone
      </Button>
    </div>
  );
}

function SettingsForm({ initial }: { initial: StoreSettings }) {
  const [base, setBase] = useState(initial);
  const defaults = useMemo(() => toValues(base), [base]);
  const { register, control, handleSubmit, reset, setError, formState: { errors, isDirty, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults, mode: "onTouched" });
  useUnsavedGuard(isDirty);
  const w = useWatch({ control });

  const onSubmit = handleSubmit(
    async (v) => {
      try {
        const saved = await updateSettings(toSettings(v));
        toast.success("Settings saved. Checkout uses them right away.");
        setBase(saved);
        reset(toValues(saved));
      } catch (e) {
        const fields = (e as { fields?: Record<string, string> }).fields;
        Object.entries(fields ?? {}).forEach(([k, m]) => { if (k in v) setError(k as keyof Values, { message: m }, { shouldFocus: true }); });
        toast.error(e instanceof Error ? e.message : "Couldn't save the settings. Try again.");
      }
    },
    () => toast.error("A few fields need attention. They're marked below."),
  );

  const free = n(w.freeShippingAbove ?? "");
  const deposit = n(w.depositPct ?? "");
  const example = 2000;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <AdminPage title="Settings">
        <div className="grid gap-4">
          <Panel title="Contact">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="WhatsApp number" error={errors.whatsapp?.message} hint="With country code, no plus or spaces: 919876543210.">
                {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="off" className="tabular" {...register("whatsapp")} />}
              </Field>
              <Field label="Contact email" error={errors.email?.message}>
                {(p) => <Input {...p} type="email" inputMode="email" autoComplete="off" {...register("email")} />}
              </Field>
            </div>
            <Effect>this is the number and address shoppers are pointed to when they ask a question.</Effect>
          </Panel>

          <Panel title="Shipping">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="India shipping charge (₹)" error={errors.domesticShipping?.message} hint="Flat rate for any order below the free-shipping amount.">
                {(p) => <Input {...p} inputMode="numeric" className="tabular" {...register("domesticShipping")} />}
              </Field>
              <Field label="Free shipping from (₹)" error={errors.freeShippingAbove?.message} hint="India orders at or above this cart total ship free.">
                {(p) => <Input {...p} inputMode="numeric" className="tabular" {...register("freeShippingAbove")} />}
              </Field>
            </div>
            <h3 className="mt-6 mb-2 text-base font-bold">International zones</h3>
            <ZonesEditor control={control} register={register} errors={errors} />
            <Effect>
              India orders under {money(w.freeShippingAbove ?? "")} pay {money(w.domesticShipping ?? "")} shipping{free !== null ? `. From ${formatINR(free)} up, shipping is free` : ""}. Abroad, the shopper&apos;s country picks a zone and pays that zone&apos;s rate.
            </Effect>
          </Panel>

          <Panel title="Cash on delivery">
            <div className="grid gap-4">
              <Checkbox label="Offer cash on delivery" {...register("codEnabled")} />
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Largest COD order (₹)" error={errors.codCap?.message} hint="Cart totals above this must be paid online.">
                  {(p) => <Input {...p} inputMode="numeric" className="tabular" {...register("codCap")} />}
                </Field>
                <Field label="COD fee (₹)" error={errors.codFee?.message} hint="Added to the order when the shopper picks cash on delivery.">
                  {(p) => <Input {...p} inputMode="numeric" className="tabular" {...register("codFee")} />}
                </Field>
              </div>
            </div>
            <Effect>
              {w.codEnabled
                ? `cash on delivery shows for India orders made only of ready-to-ship pieces, up to ${money(w.codCap ?? "")}, with a ${money(w.codFee ?? "")} fee. It never shows for made-to-order pieces, custom work or orders abroad.`
                : "cash on delivery is hidden. Every shopper pays online."}
            </Effect>
          </Panel>

          <Panel title="Gift wrap">
            <Field label="Gift wrap price (₹)" error={errors.giftWrapPrice?.message} className="md:max-w-xs">
              {(p) => <Input {...p} inputMode="numeric" className="tabular" {...register("giftWrapPrice")} />}
            </Field>
            <Effect>shoppers who tick gift wrap pay {money(w.giftWrapPrice ?? "")} more. Set 0 to make it free.</Effect>
          </Panel>

          <Panel title="Custom orders">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Advance to start (%)" error={errors.depositPct?.message} hint="Paid when the shopper accepts your quote.">
                {(p) => <Input {...p} inputMode="numeric" className="tabular" {...register("depositPct")} />}
              </Field>
              <Field label="Quote stays open (days)" error={errors.quoteValidityDays?.message} hint="After this, the quote expires and you can send a new one.">
                {(p) => <Input {...p} inputMode="numeric" className="tabular" {...register("quoteValidityDays")} />}
              </Field>
            </div>
            <Effect>
              new quotes default to {deposit ?? "…"}% up front and stay open {n(w.quoteValidityDays ?? "") ?? "…"} days.
              {deposit !== null && deposit >= 1 && deposit <= 100 ? ` Example: on a ${formatINR(example)} quote the shopper pays ${formatINR(Math.round((example * deposit) / 100))} to start and ${formatINR(example - Math.round((example * deposit) / 100))} before shipping.` : ""} Quotes already sent keep the terms they were sent with.
            </Effect>
          </Panel>
        </div>
      </AdminPage>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center justify-between gap-2 rounded-ticket bg-paper px-4 py-2.5 shadow-lift lg:bottom-4">
        <p aria-live="polite" className="text-sm font-semibold text-brown">{isDirty ? "Unsaved changes" : "All changes saved"}</p>
        <div className="flex gap-2">
          {isDirty ? <Button type="button" variant="ghost" onClick={() => reset(defaults)}>Discard</Button> : null}
          <Button type="submit" disabled={isSubmitting || !isDirty}>{isSubmitting ? "Saving…" : "Save settings"}</Button>
        </div>
      </div>
    </form>
  );
}

export function SettingsClient() {
  const { data, error, loading, reload } = useApi(getAdminSettings, "admin-settings");
  if (error) return <ErrorNote onRetry={reload}>{error.message || "Settings didn't load."}</ErrorNote>;
  if (loading || !data) {
    return (
      <div role="status" aria-label="Loading settings" className="space-y-4">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-44" />
        <Skeleton className="h-80" />
        <Skeleton className="h-56" />
      </div>
    );
  }
  return <SettingsForm initial={data} />;
}
