"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Info, LogIn, Send } from "lucide-react";
import { toast } from "sonner";
import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ErrorNote, SwatchPicker } from "@/components/ui/misc";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { ThreadStepper } from "@/components/custom/ThreadStepper";
import { clearDraft, saveDraft, type CustomDraft } from "@/components/custom/draft";
import { mergePalette } from "@/components/custom/palette";
import { createRequest } from "@/lib/api/custom";
import { getSettings } from "@/lib/api/settings";
import { useApi } from "@/lib/api/useApi";
import { ApiError } from "@/lib/mock/db";
import {
  BUDGET_PRESETS,
  CUSTOM_DEFAULTS,
  CUSTOM_STEP_FIELDS,
  MAX_REFERENCES,
  MIN_NEEDED_BY_DAYS,
  customSchema,
  dateInDays,
  type CustomFormValues,
} from "@/lib/schemas/custom";
import { useAuth } from "@/lib/state/AuthContext";
import { SAMPLE_SETTINGS } from "@/lib/site";
import { COUNTRIES, OCCASIONS } from "@/lib/status";
import { formatDate, formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Category, Product } from "@/lib/types";

const STEP_LABELS = ["The idea", "The details", "Budget", "Send"];
const STEP_TITLES = ["The idea", "The details", "Budget and delivery", "Review and send"];

/** PLACEHOLDER(custom-lead-time): rough days a from-scratch piece takes, used only for the "needed by" warning. */
const DEFAULT_CUSTOM_LEAD_DAYS = 10;

const chip =
  "press inline-flex min-h-11 items-center rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors duration-150 [@media(hover:hover)_and_(pointer:fine)]:hover:border-cocoa";

interface Props {
  initial: CustomDraft | null;
  product?: Product;
  from?: string;
  categories: Category[];
  resume: boolean;
}

export function CustomForm({ initial, product, from, categories, resume }: Props) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: settings } = useApi(getSettings, "settings");
  const deposit = settings?.depositPct ?? SAMPLE_SETTINGS.depositPct;

  const [step, setStep] = useState(initial?.step ?? 0);
  const [reached, setReached] = useState(initial?.step ?? 0);
  const [submitError, setSubmitError] = useState<string>();
  const [sending, setSending] = useState(false);
  const done = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const ticketRef = useRef<HTMLDivElement>(null);
  const firstStep = useRef(true);
  const prefilled = useRef(!!initial?.prefilled);

  const form = useForm<CustomFormValues>({
    resolver: zodResolver(customSchema),
    mode: "onTouched",
    defaultValues: { ...CUSTOM_DEFAULTS, ...initial?.values },
  });
  const { register, control, setValue, getValues, trigger, handleSubmit, setError, reset, formState } = form;
  const { errors } = formState;
  const v = useWatch({ control });

  // Prefill from the base product once it arrives (only for a fresh draft)
  useEffect(() => {
    if (!product || prefilled.current) return;
    prefilled.current = true;
    if (!getValues("category")) setValue("category", product.category);
    if (getValues("colours").length === 0) setValue("colours", product.swatches.map((s) => s.name));
    if (!getValues("title")) setValue("title", `Custom ${product.name}`);
  }, [product, getValues, setValue]);

  // Contact prefill
  useEffect(() => {
    if (user?.phone && !getValues("phone")) setValue("phone", user.phone);
  }, [user, getValues, setValue]);

  // Back from the login round-trip
  useEffect(() => {
    if (resume && user) toast.success("Welcome back. Your work order is ready to send.");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume, !!user]);

  // Persist the draft (debounced) so a refresh or a login round-trip never loses it
  useEffect(() => {
    const t = setTimeout(() => {
      if (done.current) return;
      saveDraft({ values: getValues(), step, from, prefilled: prefilled.current });
    }, 350);
    return () => clearTimeout(t);
  }, [v, step, from, getValues]);

  // Move focus to the new step's heading (not on first paint)
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false;
      return;
    }
    headingRef.current?.focus({ preventScroll: true });
    ticketRef.current?.scrollIntoView({ block: "start" });
  }, [step]);

  const swatches = mergePalette(product?.swatches);
  const catName = (slug?: string) => (slug === "other" ? "Something else" : (categories.find((c) => c.slug === slug)?.name ?? slug ?? ""));
  const err = (k: keyof CustomFormValues) => errors[k]?.message as string | undefined;

  function goTo(i: number) {
    setStep(i);
    setReached((r) => Math.max(r, i));
  }

  async function next() {
    const ok = await trigger(CUSTOM_STEP_FIELDS[step], { shouldFocus: true });
    if (ok) goTo(step + 1);
  }

  async function send(values: CustomFormValues) {
    setSubmitError(undefined);
    if (!user) {
      saveDraft({ values, step: 3, from, prefilled: prefilled.current });
      router.push(`/login?next=${encodeURIComponent("/custom?resume=1")}`);
      return;
    }
    setSending(true);
    try {
      const notes = [
        values.colourNotes ? `Colour notes: ${values.colourNotes}` : "",
        values.giftWrap ? "Gift wrap requested." : "",
      ].filter(Boolean);
      const wo = await createRequest({
        kind: product ? "CUSTOMIZE" : "NEW",
        baseProductSlug: product?.slug,
        category: values.category,
        title: values.title,
        description: [values.description, ...notes].join("\n\n"),
        colours: values.colours,
        size: values.size,
        quantity: values.quantity,
        budgetMin: values.budgetMin,
        budgetMax: values.budgetMax,
        neededBy: values.neededBy || undefined,
        occasion: values.occasion || undefined,
        personalization: values.personalization || undefined,
        references: values.references,
        country: values.country,
        postalCode: values.postalCode,
        phone: values.phone,
      });
      done.current = true;
      clearDraft();
      router.push(`/custom/sent/${wo.number}`);
    } catch (e) {
      setSending(false);
      if (e instanceof ApiError && e.fields) {
        for (const [k, msg] of Object.entries(e.fields)) if (k in CUSTOM_DEFAULTS) setError(k as keyof CustomFormValues, { message: msg });
      }
      setSubmitError(e instanceof Error ? e.message : "We couldn't send your work order. Your draft is safe, so please try again.");
    }
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step < 3) void next();
    else void handleSubmit(send)(e);
  }

  function startOver() {
    done.current = true;
    clearDraft();
    reset({ ...CUSTOM_DEFAULTS });
    prefilled.current = true;
    setStep(0);
    setReached(0);
    toast("Draft cleared.");
    setTimeout(() => (done.current = false), 0);
  }

  // Needed-by vs how long a piece takes
  const leadDays = product?.leadTimeDays ?? DEFAULT_CUSTOM_LEAD_DAYS;
  const daysUntil = v.neededBy ? Math.ceil((new Date(`${v.neededBy}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)) / 86_400_000) : null;
  const tight = daysUntil !== null && daysUntil >= MIN_NEEDED_BY_DAYS && daysUntil < leadDays;

  const qty = Number(v.quantity);
  const budgetMin = Number(v.budgetMin);
  const budgetMax = Number(v.budgetMax);
  const preset = BUDGET_PRESETS.find((p) => p.min === budgetMin && p.max === budgetMax);

  return (
    <div ref={ticketRef} className="scroll-mt-24">
      <Ticket head={["Work order · WO-NEW", product ? "Customize" : "New idea"]} className="p-2.5 md:p-3.5">
        <form onSubmit={onSubmit} noValidate className="rounded-[10px] bg-paper p-5 md:p-8">
          <ThreadStepper steps={STEP_LABELS} current={step} reached={reached} onSelect={goTo} />

          <div key={step} className="mt-8 animate-[fade-in_220ms_var(--ease-out)] motion-reduce:animate-none">
            <h2 ref={headingRef} tabIndex={-1} className="font-display text-[2rem] outline-none sm:text-[2.5rem]">
              {STEP_TITLES[step]}
            </h2>

            {step === 0 ? (
              <div className="mt-5 space-y-5">
                <Field label="What kind of thing is it?" error={err("category")}>
                  {(p) => (
                    <Select {...p} {...register("category")}>
                      <option value="">Pick the closest category</option>
                      {categories.map((c) => (
                        <option key={c.slug} value={c.slug}>
                          {c.name}
                        </option>
                      ))}
                      <option value="other">Something else</option>
                    </Select>
                  )}
                </Field>
                <Field label="Name your idea" error={err("title")} hint="A short title, like “Bear in a graduation cap”.">
                  {(p) => <Input {...p} maxLength={60} {...register("title")} />}
                </Field>
                <Field
                  label="Describe it"
                  error={err("description")}
                  hint={
                    <>
                      Size, colours, who it&apos;s for, anything we should know.{" "}
                      <span className="tabular">{(v.description ?? "").trim().length}/30 minimum</span>
                    </>
                  }
                >
                  {(p) => (
                    <Textarea
                      {...p}
                      rows={6}
                      placeholder={product ? `What would you change about ${product.name}?` : "Tell us what you're picturing."}
                      {...register("description")}
                    />
                  )}
                </Field>
                <Controller
                  control={control}
                  name="references"
                  render={({ field }) => (
                    <ImageUploader
                      label="Reference photos"
                      hint={`Up to ${MAX_REFERENCES}. Photos of what you like: shape, colours, a pet, a drawing.`}
                      max={MAX_REFERENCES}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <p className="flex items-start gap-2 text-sm text-brown">
                  <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
                  We can&apos;t make licensed characters (Disney, Sanrio, anime and the like). Original designs only.
                </p>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="mt-5 space-y-6">
                <div>
                  <p className="mb-2 text-sm font-semibold">
                    Colours <span className="font-normal text-brown-soft">(pick any)</span>
                  </p>
                  <Controller
                    control={control}
                    name="colours"
                    render={({ field }) => <SwatchPicker multiple swatches={swatches} value={field.value} onChange={field.onChange} label="Colours" />}
                  />
                  <p className="mt-1.5 text-sm text-brown">
                    Colours may vary slightly between screens and yarn batches.
                  </p>
                  <Field label="Other colours or shades" optional error={err("colourNotes")} className="mt-3">
                    {(p) => <Input {...p} maxLength={200} placeholder="Like “the green of a pistachio”" {...register("colourNotes")} />}
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Size" optional error={err("size")} hint="Height or width in cm, or “as big as my palm”.">
                    {(p) => <Input {...p} maxLength={80} placeholder="Like 15 cm tall" {...register("size")} />}
                  </Field>
                  <Field label="How many?" error={err("quantity")}>
                    {(p) => <Input {...p} type="number" inputMode="numeric" min={1} max={50} step={1} className="tabular" {...register("quantity", { valueAsNumber: true })} />}
                  </Field>
                </div>
                {qty > 10 ? (
                  <p role="status" className="rounded-[12px] bg-butter/40 px-4 py-3 text-sm">
                    <strong className="font-semibold">That&apos;s a bulk order.</strong> Tell us what it&apos;s for, like a wedding, a company or a class. We&apos;ll quote a bulk price and a realistic timeline.
                  </p>
                ) : null}

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Personalization" optional error={err("personalization")} hint="A name, date or short message to stitch in.">
                    {(p) => <Input {...p} maxLength={60} {...register("personalization")} />}
                  </Field>
                  <Field label="Occasion" optional error={err("occasion")}>
                    {(p) => (
                      <Select {...p} {...register("occasion")}>
                        <option value="">No particular occasion</option>
                        {OCCASIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>

                <div>
                  <Field
                    label="Needed by"
                    optional
                    error={err("neededBy")}
                    hint={`Earliest is ${formatDate(dateInDays(MIN_NEEDED_BY_DAYS), { day: "numeric", month: "short" })}, ${MIN_NEEDED_BY_DAYS} days from today.`}
                    className="sm:max-w-xs"
                  >
                    {(p) => <Input {...p} type="date" min={dateInDays(MIN_NEEDED_BY_DAYS)} className="tabular" {...register("neededBy")} />}
                  </Field>
                  {tight ? (
                    <p role="status" data-placeholder="custom-lead-time" className="relative mt-2 rounded-[12px] bg-warn-wash px-4 py-3 text-sm text-warn">
                      {product ? `${product.name} usually takes about ${leadDays} days to make` : `Custom pieces often take ${leadDays} days or more`}, so this date may be tight. Send it anyway and we&apos;ll tell you what&apos;s possible.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="mt-5 space-y-6">
                <fieldset>
                  <legend className="mb-2 text-sm font-semibold">Your budget</legend>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {BUDGET_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        aria-pressed={preset === p}
                        onClick={() => {
                          setValue("budgetMin", p.min, { shouldValidate: true, shouldDirty: true });
                          setValue("budgetMax", p.max, { shouldValidate: true, shouldDirty: true });
                        }}
                        className={cn(chip, preset === p ? "border-cocoa bg-cocoa text-cream" : "border-line-strong bg-paper")}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="At least (₹)" error={err("budgetMin")}>
                      {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={50} className="tabular" {...register("budgetMin", { valueAsNumber: true })} />}
                    </Field>
                    <Field label="At most (₹)" error={err("budgetMax")}>
                      {(p) => <Input {...p} type="number" inputMode="numeric" min={0} step={50} className="tabular" {...register("budgetMax", { valueAsNumber: true })} />}
                    </Field>
                  </div>
                  <p className="mt-2 text-sm text-brown">This isn&apos;t a promise. We quote a fair price and you can accept, counter or pass.</p>
                </fieldset>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Country" error={err("country")}>
                    {(p) => (
                      <Select {...p} autoComplete="country" {...register("country", { onChange: () => setValue("postalCode", "") })}>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={v.country === "IN" ? "Pincode" : "Postal code"} error={err("postalCode")} hint="Where it will be delivered, so we can plan shipping.">
                    {(p) => (
                      <Input
                        {...p}
                        autoComplete="postal-code"
                        inputMode={v.country === "IN" ? "numeric" : "text"}
                        maxLength={v.country === "IN" ? 6 : 12}
                        className="tabular"
                        {...register("postalCode")}
                      />
                    )}
                  </Field>
                </div>

                <Checkbox label="Wrap it as a gift" {...register("giftWrap")} />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="mt-5 space-y-6">
                <div className="divide-y divide-line border-y border-line">
                  <SummaryGroup title="The idea" onEdit={() => goTo(0)}>
                    <SummaryRow label="Category" value={catName(v.category)} />
                    <SummaryRow label="Name" value={v.title} />
                    <SummaryRow label="Description" value={<span className="line-clamp-4 whitespace-pre-line">{v.description}</span>} />
                    <SummaryRow label="Photos" value={v.references?.length ? `${v.references.length} attached` : "None"} />
                  </SummaryGroup>
                  <SummaryGroup title="The details" onEdit={() => goTo(1)}>
                    <SummaryRow label="Colours" value={[...(v.colours ?? []), v.colourNotes].filter(Boolean).join(", ") || "Your call"} />
                    <SummaryRow label="Size" value={v.size || "Not specified"} />
                    <SummaryRow label="Quantity" value={String(v.quantity)} />
                    {v.personalization ? <SummaryRow label="Personalization" value={v.personalization} /> : null}
                    {v.occasion ? <SummaryRow label="Occasion" value={v.occasion} /> : null}
                    <SummaryRow label="Needed by" value={v.neededBy ? formatDate(v.neededBy, { day: "numeric", month: "short", year: "numeric" }) : "No fixed date"} />
                  </SummaryGroup>
                  <SummaryGroup title="Budget and delivery" onEdit={() => goTo(2)}>
                    <SummaryRow label="Budget" value={Number.isFinite(budgetMin) && Number.isFinite(budgetMax) ? `${formatINR(budgetMin)} to ${formatINR(budgetMax)}` : ""} />
                    <SummaryRow label="Delivery" value={`${COUNTRIES.find((c) => c.code === v.country)?.name ?? v.country}, ${v.postalCode}`} />
                    {v.giftWrap ? <SummaryRow label="Gift wrap" value="Yes" /> : null}
                  </SummaryGroup>
                </div>

                <Field label="Phone or WhatsApp" error={err("phone")} hint="With country code, like +91 98765 43210. This is how we'll reach you about the quote.">
                  {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" {...register("phone")} />}
                </Field>

                <div>
                  <Checkbox
                    label={
                      <>
                        I understand: {deposit}% advance to start, custom pieces can&apos;t be returned, colours may vary slightly, and no licensed characters.
                      </>
                    }
                    aria-invalid={errors.terms ? true : undefined}
                    aria-describedby={errors.terms ? "terms-err" : undefined}
                    {...register("terms")}
                  />
                  {errors.terms ? (
                    <p id="terms-err" role="alert" className="text-sm font-medium text-err">
                      {err("terms")}
                    </p>
                  ) : null}
                </div>

                <p className="rounded-[12px] bg-cream px-4 py-3 text-sm text-brown">
                  {user
                    ? `Sending as ${user.name} (${user.email}). We'll reply in your account, and we'll never charge anything until you accept a quote.`
                    : "You'll log in or create an account when you send, so the quote and updates land in one place. Your draft is saved and will be waiting for you."}
                </p>

                {submitError ? <ErrorNote>{submitError}</ErrorNote> : null}
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={() => goTo(step - 1)}>
                <ArrowLeft /> Back
              </Button>
            ) : (
              <span />
            )}
            {step < 3 ? (
              <Button type="submit" size="lg">
                Next: {STEP_LABELS[step + 1].toLowerCase()} <ArrowRight />
              </Button>
            ) : (
              <Button type="submit" size="lg" disabled={sending || authLoading} aria-busy={sending}>
                {sending ? (
                  "Sending your work order"
                ) : authLoading ? (
                  "Checking your login"
                ) : user ? (
                  <>
                    <Send /> Send work order
                  </>
                ) : (
                  <>
                    <LogIn /> Log in to send
                  </>
                )}
              </Button>
            )}
          </div>

          <p className="mt-5 flex flex-wrap items-center justify-between gap-2 text-xs text-brown-soft">
            <span aria-live="polite">Your draft is saved on this device.</span>
            <button type="button" onClick={startOver} className="min-h-11 underline [@media(hover:hover)_and_(pointer:fine)]:hover:text-cocoa">
              Clear draft and start over
            </button>
          </p>
        </form>
      </Ticket>
    </div>
  );
}

function SummaryGroup({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <section aria-label={title} className="py-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="font-stencil text-[11px] text-brown-soft">{title}</h3>
        <button type="button" onClick={onEdit} className="-my-2 min-h-11 text-sm font-semibold underline [@media(hover:hover)_and_(pointer:fine)]:hover:text-brown">
          Edit<span className="sr-only"> {title.toLowerCase()}</span>
        </button>
      </div>
      <dl className="space-y-1.5">{children}</dl>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 text-[15px]">
      <dt className="text-brown">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}
