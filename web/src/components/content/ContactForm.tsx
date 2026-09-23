"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { SITE } from "@/lib/site";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your name so we know who to reply to."),
  email: z.string().trim().email("Enter a valid email address, like name@example.com."),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more, at least 10 characters.")
    .max(1500, "Please keep your message under 1,500 characters."),
});
type Values = z.infer<typeof schema>;

/**
 * Mock send: nothing leaves the browser. The real endpoint replaces `send` when the API exists.
 * PLACEHOLDER(contact-form): swap the simulated delay for a POST to the API.
 */
async function send(values: Values) {
  void values;
  await new Promise((r) => setTimeout(r, 700));
}

export function ContactForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", message: "" } });

  const onSubmit = async (values: Values) => {
    try {
      await send(values);
      setSent(true);
      reset();
      toast.success(SITE.useMock ? "Sample mode: nothing was actually sent." : "Message sent. We will reply by email.");
    } catch {
      toast.error("We couldn't send that. Check your connection and try again, or use WhatsApp.");
    }
  };

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 rounded-ticket bg-paper p-6 shadow-ticket">
        <CheckCircle2 aria-hidden strokeWidth={1.8} className="size-8 text-ok" />
        <h3 className="text-xl font-bold">{SITE.useMock ? "Sample mode: nothing was sent" : "Message sent"}</h3>
        <p className="max-w-[44ch] text-brown">
          {SITE.useMock
            ? "This form is not connected yet. Please use WhatsApp to reach the maker."
            : "Thanks for writing. We will reply to the email address you gave us."}
        </p>
        <Button variant="secondary" onClick={() => setSent(false)}>
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5 rounded-ticket bg-paper p-5 shadow-ticket sm:p-7">
      <Field label="Your name" error={errors.name?.message}>
        {(p) => <Input {...p} autoComplete="name" {...register("name")} />}
      </Field>
      <Field label="Email" error={errors.email?.message}>
        {(p) => <Input {...p} type="email" inputMode="email" autoComplete="email" {...register("email")} />}
      </Field>
      <Field label="Message" hint="For an order, include the order number." error={errors.message?.message}>
        {(p) => <Textarea {...p} rows={6} {...register("message")} />}
      </Field>
      <p className="text-sm leading-relaxed text-brown">
        We use your details only to reply to you. See the <Link className="font-medium text-cocoa underline" href="/policies/privacy">privacy policy</Link>.
      </p>
      {SITE.useMock ? (
        <p data-placeholder="contact-form" className="relative rounded-[10px] bg-butter/30 px-3 py-2 text-sm text-cocoa">
          Sample mode: this form does not send anything yet. Use WhatsApp for a real reply.
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={isSubmitting} aria-busy={isSubmitting} className="w-full sm:w-auto">
        <Send aria-hidden strokeWidth={1.8} />
        {isSubmitting ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
