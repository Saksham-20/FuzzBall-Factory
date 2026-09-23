"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { PasswordInput } from "@/components/account/PasswordInput";
import { FormError, applyApiError } from "@/components/account/auth/authUtils";
import { resetPassword } from "@/lib/api/auth";

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string().min(1, "Type the new password again."),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The two passwords don't match." });
type Values = z.infer<typeof schema>;

export function ResetForm({ token }: { token?: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { password: "", confirm: "" } });

  if (!token) {
    return (
      <>
        <h1 className="font-display text-[clamp(2.75rem,8vw,3.75rem)]">Link incomplete</h1>
        <p className="mt-3 max-w-[46ch] text-brown">This reset link is missing its token, so we can&apos;t tell it&apos;s really yours. Ask for a fresh link and open it straight from the email.</p>
        <Button asChild className="mt-8">
          <Link href="/forgot-password">Get a new reset link</Link>
        </Button>
      </>
    );
  }

  async function onSubmit(v: Values) {
    setFormError("");
    try {
      await resetPassword(token!, v.password);
      toast.success("Password updated. Log in with your new one.");
      router.replace("/login");
    } catch (e) {
      setFormError(applyApiError(e, setError, ["password"]));
    }
  }

  return (
    <>
      <h1 className="font-display text-[clamp(2.75rem,8vw,3.75rem)]">Choose a new password</h1>
      <p className="mt-3 text-brown">Pick something you don&apos;t use anywhere else.</p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
        {formError ? <FormError>{formError}</FormError> : null}
        <Field label="New password" hint="At least 8 characters." error={errors.password?.message}>
          {(p) => <PasswordInput {...p} {...register("password")} autoComplete="new-password" />}
        </Field>
        <Field label="Confirm new password" error={errors.confirm?.message}>
          {(p) => <PasswordInput {...p} {...register("confirm")} autoComplete="new-password" />}
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </>
  );
}
