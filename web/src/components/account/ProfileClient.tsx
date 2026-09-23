"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AccountHeading } from "@/components/account/AccountShell";
import { PasswordInput } from "@/components/account/PasswordInput";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Field";
import { ErrorNote } from "@/components/ui/misc";
import * as account from "@/lib/api/account";
import { useAuth } from "@/lib/state/AuthContext";
import { ApiError } from "@/lib/mock/db";
import type { User } from "@/lib/types";

export function ProfileClient() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <div>
      <AccountHeading title="Profile" />
      <div className="mt-8 max-w-[34rem] divide-y divide-line">
        <section aria-labelledby="details-h" className="pb-10">
          <h2 id="details-h" className="font-display text-[2rem]">
            Your details
          </h2>
          <DetailsForm user={user} />
        </section>
        <section aria-labelledby="pw-h" className="py-10">
          <h2 id="pw-h" className="font-display text-[2rem]">
            Change password
          </h2>
          <PasswordForm />
        </section>
        <section aria-labelledby="del-h" className="pt-10">
          <h2 id="del-h" className="font-display text-[2rem]">
            Delete your account
          </h2>
          <DeleteAccount />
        </section>
      </div>
    </div>
  );
}

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name so we can address your parcels."),
  email: z.email("That email doesn't look right. Check for typos."),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[0-9\s-]{7,16}$/.test(v), "Use digits only, with the country code if you're outside India."),
});
type DetailsValues = z.infer<typeof detailsSchema>;

function DetailsForm({ user }: { user: User }) {
  const { refresh } = useAuth();
  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema), defaultValues: { name: user.name, email: user.email, phone: user.phone ?? "" } });

  async function onSubmit(v: DetailsValues) {
    setFormError("");
    try {
      await account.updateProfile({ name: v.name, email: v.email, phone: v.phone || undefined });
      await refresh();
      reset(v);
      toast.success("Profile saved.");
    } catch (e) {
      if (e instanceof ApiError) for (const [k, m] of Object.entries(e.fields ?? {})) if (k in v) setError(k as keyof DetailsValues, { message: m });
      setFormError(e instanceof ApiError ? e.message : "We couldn't save your details. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-5">
      {formError ? <ErrorNote>{formError}</ErrorNote> : null}
      <Field label="Name" error={errors.name?.message}>
        {(p) => <Input {...p} {...register("name")} autoComplete="name" />}
      </Field>
      <Field label="Email" error={errors.email?.message}>
        {(p) => <Input {...p} {...register("email")} type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} />}
      </Field>
      <Field label="Phone" optional hint="For delivery updates and WhatsApp." error={errors.phone?.message}>
        {(p) => <Input {...p} {...register("phone")} type="tel" inputMode="tel" autoComplete="tel" />}
      </Field>
      <Button type="submit" disabled={isSubmitting || !isDirty} aria-busy={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

const pwSchema = z
  .object({
    current: z.string().min(1, "Enter your current password."),
    next: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string().min(1, "Type the new password again."),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "The two passwords don't match." });
type PwValues = z.infer<typeof pwSchema>;

function PasswordForm() {
  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PwValues>({ resolver: zodResolver(pwSchema), defaultValues: { current: "", next: "", confirm: "" } });

  async function onSubmit(v: PwValues) {
    setFormError("");
    try {
      await account.changePassword(v.current, v.next);
      reset();
      toast.success("Password changed.");
    } catch (e) {
      if (e instanceof ApiError) for (const [k, m] of Object.entries(e.fields ?? {})) if (k in v) setError(k as keyof PwValues, { message: m });
      setFormError(e instanceof ApiError ? e.message : "We couldn't change your password. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-5">
      {formError ? <ErrorNote>{formError}</ErrorNote> : null}
      <Field label="Current password" error={errors.current?.message}>
        {(p) => <PasswordInput {...p} {...register("current")} autoComplete="current-password" />}
      </Field>
      <Field label="New password" hint="At least 8 characters." error={errors.next?.message}>
        {(p) => <PasswordInput {...p} {...register("next")} autoComplete="new-password" />}
      </Field>
      <Field label="Confirm new password" error={errors.confirm?.message}>
        {(p) => <PasswordInput {...p} {...register("confirm")} autoComplete="new-password" />}
      </Field>
      <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? "Changing…" : "Change password"}
      </Button>
    </form>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requested, setRequested] = useState(false);

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await account.requestAccountDeletion();
      setRequested(true);
      setOpen(false);
      toast.success("Deletion requested.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    // PLACEHOLDER(dpdp-deletion): wording is a stand-in until the privacy policy is written; the API call is a mock that records nothing.
    <div data-placeholder="dpdp-deletion" className="relative">
      <p className="mt-3 max-w-[56ch] text-brown">
        Under India&apos;s Digital Personal Data Protection Act you can ask us to delete your data. Once you ask, we&apos;ll delete it within 30 days.
      </p>
      {requested ? (
        <p role="status" className="mt-5 rounded-[12px] bg-warn-wash px-4 py-3 font-medium text-warn">
          Deletion requested. We&apos;ll delete your data within 30 days. Changed your mind? Message us before then.
        </p>
      ) : (
        <Button variant="secondary" className="mt-5" onClick={() => setOpen(true)}>
          Request account deletion
        </Button>
      )}
      <Modal
        open={open}
        onOpenChange={(o) => {
          if (!busy) {
            setOpen(o);
            if (!o) setError("");
          }
        }}
        title="Delete your account?"
        description="We'll delete your account and personal data within 30 days. You'll lose access to your order history and saved addresses."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Keep my account
            </Button>
            <Button onClick={confirm} disabled={busy} aria-busy={busy}>
              {busy ? "Sending…" : "Request deletion"}
            </Button>
          </>
        }
      >
        {error ? <ErrorNote>{error}</ErrorNote> : null}
      </Modal>
    </div>
  );
}
