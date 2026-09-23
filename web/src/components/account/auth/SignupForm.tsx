"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Checkbox, Field, Input } from "@/components/ui/Field";
import { PasswordInput } from "@/components/account/PasswordInput";
import { FormError, GuestOnly, applyApiError } from "@/components/account/auth/authUtils";
import { useAuth } from "@/lib/state/AuthContext";

const schema = z.object({
  name: z.string().trim().min(2, "Tell us your name so we can address your parcels."),
  email: z.email("That email doesn't look right. Check for typos."),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[0-9\s-]{7,16}$/.test(v), "Use digits only, with the country code if you're outside India (for example +44 7700 900456)."),
  password: z.string().min(8, "Use at least 8 characters."),
  terms: z.boolean().refine((v) => v, "Tick the box to accept the terms and privacy policy."),
});
type Values = z.infer<typeof schema>;

function strengthHint(pw: string) {
  if (pw.length === 0) return "At least 8 characters. A short phrase you'll remember works well.";
  if (pw.length < 8) return `${8 - pw.length} more ${8 - pw.length === 1 ? "character" : "characters"} to go.`;
  const kinds = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (pw.length >= 12 || kinds >= 3) return "Strong. You're all set.";
  return "Good. Mixing in a number or a symbol makes it stronger.";
}

export function SignupForm() {
  const { signup } = useAuth();
  const router = useRouter();
  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: "", email: "", phone: "", password: "", terms: false } });
  const pw = useWatch({ control, name: "password" }) ?? "";

  async function onSubmit(v: Values) {
    setFormError("");
    try {
      const user = await signup({ name: v.name, email: v.email, phone: v.phone || undefined, password: v.password });
      toast.success(`Welcome to the factory, ${user.name.split(" ")[0]}.`);
      router.replace("/account");
    } catch (e) {
      setFormError(applyApiError(e, setError, ["name", "email", "phone", "password"]));
    }
  }

  return (
    <GuestOnly signedInTo="/account">
      <h1 className="font-display text-[clamp(2.75rem,8vw,3.75rem)]">Join the factory</h1>
      <p className="mt-3 text-brown">An account keeps your orders, work orders, addresses and wishlist in one place.</p>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
        {formError ? <FormError>{formError}</FormError> : null}
        <Field label="Your name" error={errors.name?.message}>
          {(p) => <Input {...p} {...register("name")} autoComplete="name" />}
        </Field>
        <Field label="Email" error={errors.email?.message}>
          {(p) => <Input {...p} {...register("email")} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} />}
        </Field>
        <Field label="Phone" optional hint="For delivery updates and WhatsApp. Add the country code if you're outside India." error={errors.phone?.message}>
          {(p) => <Input {...p} {...register("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98000 00000" />}
        </Field>
        <Field label="Password" hint={strengthHint(pw)} error={errors.password?.message}>
          {(p) => <PasswordInput {...p} {...register("password")} autoComplete="new-password" />}
        </Field>
        <div>
          <Checkbox
            aria-invalid={errors.terms ? true : undefined}
            label={
              <>
                I accept the{" "}
                <Link href="/policies/terms" className="font-semibold underline">
                  terms
                </Link>{" "}
                and{" "}
                <Link href="/policies/privacy" className="font-semibold underline">
                  privacy policy
                </Link>
                .
              </>
            }
            {...register("terms")}
          />
          {errors.terms ? (
            <p role="alert" className="text-sm font-medium text-err">
              {errors.terms.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? "Creating your account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-brown">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-cocoa underline">
          Log in
        </Link>
      </p>
    </GuestOnly>
  );
}
