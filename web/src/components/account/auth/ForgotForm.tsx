"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { FormError } from "@/components/account/auth/authUtils";
import { forgotPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/mock/db";

const schema = z.object({ email: z.email("That email doesn't look right. Check for typos.") });
type Values = z.infer<typeof schema>;

export function ForgotForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });

  async function onSubmit(v: Values) {
    setFormError("");
    try {
      await forgotPassword(v.email);
      setSentTo(v.email);
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : "We couldn't send that just now. Please try again in a moment.");
    }
  }

  if (sentTo) {
    return (
      <div role="status">
        <MailCheck className="size-9 text-cocoa" strokeWidth={1.8} aria-hidden />
        <h1 className="mt-4 font-display text-[clamp(2.75rem,8vw,3.75rem)]">Check your inbox</h1>
        {/* Same message for every address, so nobody can probe which emails have accounts. */}
        <p className="mt-3 max-w-[46ch] text-brown">
          If <span className="font-semibold text-cocoa">{sentTo}</span> has an account, we&apos;ve sent a reset link to it. It can take a few minutes; check spam too.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/login">Back to log in</Link>
          </Button>
          <Button variant="ghost" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display text-[clamp(2.75rem,8vw,3.75rem)]">Reset your password</h1>
      <p className="mt-3 text-brown">Enter the email you signed up with and we&apos;ll send you a link to set a new password.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
        {formError ? <FormError>{formError}</FormError> : null}
        <Field label="Email" error={errors.email?.message}>
          {(p) => <Input {...p} {...register("email")} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} />}
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <p className="mt-6 text-brown">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-cocoa underline">
          Log in
        </Link>
      </p>
    </>
  );
}
