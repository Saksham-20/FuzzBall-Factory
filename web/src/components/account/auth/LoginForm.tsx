"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input } from "@/components/ui/Field";
import { PasswordInput } from "@/components/account/PasswordInput";
import { FormError, GuestOnly, applyApiError, destinationFor } from "@/components/account/auth/authUtils";
import { useAuth } from "@/lib/state/AuthContext";
import { SITE } from "@/lib/site";

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter the email or phone number you signed up with."),
  password: z.string().min(1, "Enter your password."),
  remember: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function LoginForm({ next }: { next?: string }) {
  const { login } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { identifier: "", password: "", remember: true } });

  async function onSubmit(v: Values) {
    setFormError("");
    try {
      const user = await login(v.identifier, v.password);
      router.replace(destinationFor(user, next));
    } catch (e) {
      setFormError(applyApiError(e, setError, ["identifier", "password"]));
    }
  }

  return (
    <GuestOnly next={next}>
      <h1 className="font-display text-[clamp(2.75rem,8vw,3.75rem)]">Welcome back</h1>
      <p className="mt-3 text-brown">Log in to see your orders, work orders and saved pieces.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
        {formError ? <FormError>{formError}</FormError> : null}
        <Field label="Email or phone" error={errors.identifier?.message}>
          {(p) => <Input {...p} {...register("identifier")} type="text" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="you@example.com" />}
        </Field>
        <Field label="Password" error={errors.password?.message}>
          {(p) => <PasswordInput {...p} {...register("password")} autoComplete="current-password" />}
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-x-4">
          <Checkbox label="Remember me" {...register("remember")} />
          <Link href="/forgot-password" className="inline-flex min-h-11 items-center text-[15px] font-semibold underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-brown">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-cocoa underline">
          Create an account
        </Link>
      </p>

      {/* PLACEHOLDER(mock-logins): dev-only hint, disappears when NEXT_PUBLIC_USE_MOCK=false. */}
      {SITE.useMock ? (
        <p data-placeholder="mock-logins" className="relative mt-8 rounded-[12px] border border-dashed border-line-strong px-4 py-3 text-sm text-brown">
          Sample logins: <span className="font-semibold">maya@example.com</span> / <span className="font-semibold">admin@fuzzball.test</span>, password <span className="font-semibold">fuzzball123</span>
        </p>
      ) : null}
    </GuestOnly>
  );
}
