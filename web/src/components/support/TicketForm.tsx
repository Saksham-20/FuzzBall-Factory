"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Send } from "lucide-react";
import { CollectionNotice } from "@/components/content/CollectionNotice";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/Field";
import { ApiError } from "@/lib/api/errors";
import { createTicket, type TicketCreated } from "@/lib/api/support";
import { CATEGORIES, KIND_LABEL } from "@/lib/support";
import { SITE } from "@/lib/site";
import { useAuth } from "@/lib/state/AuthContext";
import type { TicketKind } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name so we know who to reply to."),
  email: z.string().trim().email("Enter a valid email address, like name@example.com."),
  phone: z.string().trim().max(30, "That phone number is too long."),
  category: z.string().min(1, "Choose a topic."),
  reference: z.string().trim().max(20, "That reference is too long."),
  message: z.string().trim().min(10, "Tell us a little more, at least 10 characters.").max(3000, "Please keep your message under 3,000 characters."),
  consent: z.boolean().refine((v) => v, "Please confirm you have read the privacy notice."),
  // Hidden honeypot: empty for people, filled by form-stuffing bots.
  website: z.string().max(200).optional(),
});
type Values = z.infer<typeof schema>;

interface Props {
  kind: TicketKind;
  /** Topic selected at first. */
  defaultCategory?: string;
  /** Topics to offer (defaults to all for the kind). */
  categories?: { value: string; label: string }[];
  messageLabel?: string;
  messageHint?: string;
  submitLabel?: string;
  /** Show the order / work-order number box. */
  withReference?: boolean;
  /** What the privacy notice at the foot of the form says we collect and why. */
  notice?: { what: string; why: string };
  /** The promise shown after sending ("We will reply within…"). */
  afterSend?: string;
}

/**
 * One form for every way into the support inbox: a question, a complaint, a takedown notice or a data request. Each
 * becomes a ticket with a reference number (see api/src/support). The sender is shown a standalone privacy notice and
 * ticks a box to say they read it; nothing is pre-ticked.
 */
export function TicketForm({
  kind,
  defaultCategory,
  categories = CATEGORIES[kind],
  messageLabel = "Message",
  messageHint,
  submitLabel = "Send",
  withReference = true,
  notice = { what: "name, email and message", why: "to reply to you and to keep a record of your request" },
  afterSend,
}: Props) {
  const { user } = useAuth();
  const [done, setDone] = useState<(TicketCreated & { email: string }) | null>(null);
  const formId = useId();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
    getValues,
    setValue,
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      category: defaultCategory ?? categories[0]?.value ?? "",
      reference: "",
      message: "",
      consent: false,
      website: "",
    },
  });

  // Fill in who they are once the account loads, without overwriting anything they have already typed.
  useEffect(() => {
    if (!user) return;
    if (!getValues("name")) setValue("name", user.name);
    if (!getValues("email")) setValue("email", user.email);
    if (!getValues("phone") && user.phone) setValue("phone", user.phone);
  }, [user, getValues, setValue]);

  const onSubmit = async (v: Values) => {
    try {
      const created = await createTicket({
        kind,
        name: v.name,
        email: v.email,
        phone: v.phone || undefined,
        category: v.category,
        reference: v.reference || undefined,
        message: v.message,
        consent: v.consent,
        website: v.website,
      });
      setDone({ ...created, email: v.email });
      reset({ name: user?.name ?? "", email: user?.email ?? "", phone: user?.phone ?? "", category: defaultCategory ?? categories[0]?.value ?? "", reference: "", message: "", consent: false, website: "" });
    } catch (e) {
      if (e instanceof ApiError && e.fields) {
        for (const [field, message] of Object.entries(e.fields)) {
          if (field in schema.shape) setError(field as keyof Values, { message });
        }
      }
      toast.error(
        e instanceof ApiError && (e.status === 429 || e.status === 400) ? e.message : "We couldn't send that. Check your connection and try again, or use WhatsApp.",
      );
    }
  };

  if (done) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 rounded-ticket bg-paper p-6 shadow-ticket">
        <CheckCircle2 aria-hidden strokeWidth={1.8} className="size-8 text-ok" />
        <h3 className="text-xl font-bold">{SITE.useMock ? "Sample mode: kept in this browser only" : "We have your request"}</h3>
        <p className="max-w-[48ch] text-brown">
          Your reference is <strong className="font-stencil tabular text-cocoa">{done.number}</strong>. {SITE.useMock ? "Nothing was emailed because this is the sample shop." : `We emailed a copy of what you sent, and a link to this request, to ${done.email}.`}{" "}
          {afterSend}
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/support/ticket/${encodeURIComponent(done.number)}?t=${encodeURIComponent(done.accessToken)}`}>Open your request</Link>
          </Button>
          <Button variant="secondary" onClick={() => setDone(null)}>
            Send another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate aria-label={KIND_LABEL[kind]} className="relative space-y-5 rounded-ticket bg-paper p-5 shadow-ticket sm:p-7">
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Leave this empty
          <input type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
        </label>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" error={errors.name?.message}>
          {(p) => <Input {...p} autoComplete="name" {...register("name")} />}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" {...register("email")} />}
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Phone" optional error={errors.phone?.message}>
          {(p) => <Input {...p} type="tel" inputMode="tel" autoComplete="tel" {...register("phone")} />}
        </Field>
        <Field label="Topic" error={errors.category?.message}>
          {(p) => (
            <Select {...p} {...register("category")}>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      {withReference ? (
        <Field label="Order or work-order number" optional hint="Like FB-1001 or WO-001. We only link it if it is yours." error={errors.reference?.message}>
          {(p) => <Input {...p} autoComplete="off" autoCapitalize="characters" {...register("reference")} />}
        </Field>
      ) : null}
      <Field label={messageLabel} hint={messageHint} error={errors.message?.message}>
        {(p) => <Textarea {...p} rows={6} {...register("message")} />}
      </Field>
      <CollectionNotice what={notice.what} why={notice.why} />
      <div>
        <Checkbox
          aria-invalid={errors.consent ? true : undefined}
          aria-describedby={errors.consent ? `${formId}-consent-err` : undefined}
          label="I have read the privacy notice above."
          {...register("consent")}
        />
        {errors.consent ? (
          <p id={`${formId}-consent-err`} role="alert" className="text-sm font-medium text-err">
            {errors.consent.message}
          </p>
        ) : null}
      </div>
      {SITE.useMock ? (
        <p data-placeholder="contact-form" className="relative rounded-[10px] bg-butter/30 px-3 py-2 text-sm text-cocoa">
          Sample mode: this is kept in your browser only. Use WhatsApp for a real reply.
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting} className="w-full sm:w-auto">
        <Send aria-hidden strokeWidth={1.8} />
        {isSubmitting ? "Sending…" : submitLabel}
      </Button>
    </form>
  );
}
