"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
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
import { resendVerification } from "@/lib/api/auth";
import { downloadJson } from "@/lib/download";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/lib/state/AuthContext";
import { ApiError } from "@/lib/api/errors";
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
        <section aria-labelledby="data-h" className="py-10">
          <h2 id="data-h" className="font-display text-[2rem]">
            Your data
          </h2>
          <DownloadData />
        </section>
        <section aria-labelledby="del-h" className="pt-10">
          <h2 id="del-h" className="font-display text-[2rem]">
            Delete your account
          </h2>
          <DeleteAccount user={user} />
        </section>
      </div>
    </div>
  );
}

const detailsSchema = z.object({
  name: z.string().trim().min(2, "Tell us your name so we can address your parcels."),
  phone: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[0-9\s-]{7,16}$/.test(v), "Use digits only, with the country code if you're outside India."),
  currentPassword: z.string(),
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
    control,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DetailsValues>({ resolver: zodResolver(detailsSchema), defaultValues: { name: user.name, phone: user.phone ?? "", currentPassword: "" } });
  // Moving the phone number (a login and a delivery contact) asks for the password, so only show the field when it is needed.
  const phoneValue = useWatch({ control, name: "phone" });
  const phoneChanged = phoneValue.replace(/[\s-]/g, "") !== (user.phone ?? "").replace(/[\s-]/g, "");

  async function onSubmit(v: DetailsValues) {
    setFormError("");
    if (phoneChanged && !v.currentPassword) {
      setError("currentPassword", { message: "Enter your current password to change your phone number." });
      return;
    }
    try {
      await account.updateProfile({ name: v.name, phone: v.phone || undefined, currentPassword: phoneChanged ? v.currentPassword : undefined });
      await refresh();
      reset({ name: v.name, phone: v.phone, currentPassword: "" });
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
      <EmailRow user={user} />
      <Field label="Phone" optional hint="For delivery updates and WhatsApp." error={errors.phone?.message}>
        {(p) => <Input {...p} {...register("phone")} type="tel" inputMode="tel" autoComplete="tel" />}
      </Field>
      {phoneChanged ? (
        <Field label="Current password" hint="We ask before changing your phone number." error={errors.currentPassword?.message}>
          {(p) => <PasswordInput {...p} {...register("currentPassword")} autoComplete="current-password" />}
        </Field>
      ) : null}
      <Button type="submit" disabled={isSubmitting || !isDirty} aria-busy={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

/** The email is not edited in place: a change is confirmed from the new inbox. Unconfirmed accounts can ask for the link again. */
function EmailRow({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const unconfirmed = user.emailVerified === false;

  async function resend() {
    setSending(true);
    try {
      await resendVerification();
      toast.success("Confirmation link sent. Check your inbox.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "We couldn't send that just now. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <p className="text-[15px] font-semibold">Email</p>
      <p className="mt-1 break-all">{user.email}</p>
      {unconfirmed ? (
        <p className="mt-1 text-[15px] text-warn">
          Not confirmed yet. We sent a link when you signed up; you can shop meanwhile, but changing your email or phone needs it.
        </p>
      ) : (
        <p className="mt-1 text-[15px] text-brown">Confirmed.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {unconfirmed ? (
          <Button type="button" variant="secondary" size="sm" onClick={resend} disabled={sending} aria-busy={sending}>
            {sending ? "Sending…" : "Send the link again"}
          </Button>
        ) : (
          <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
            Change email
          </Button>
        )}
      </div>
      <ChangeEmailModal open={open} onOpenChange={setOpen} />
    </div>
  );
}

function ChangeEmailModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [sentTo, setSentTo] = useState("");

  function close(o: boolean) {
    if (busy) return;
    onOpenChange(o);
    if (!o) {
      setError("");
      setFields({});
      setPassword("");
      setSentTo("");
      setEmail("");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFields({});
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setFields({ email: "That email doesn't look right. Check for typos." });
    if (!password) return setFields({ password: "Enter your password to confirm it's you." });
    setBusy(true);
    try {
      await account.changeEmail(email, password);
      setSentTo(email.trim());
    } catch (err) {
      if (err instanceof ApiError) {
        setFields(err.fields ?? {});
        if (!err.fields || Object.keys(err.fields).length === 0) setError(err.message);
      } else setError("We couldn't send that just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={sentTo ? "Check the new inbox" : "Change your email"}
      description={sentTo ? undefined : "We'll send a confirmation link to the new address. Your email only changes once you open it, and we'll tell your current address too."}
    >
      {sentTo ? (
        <div role="status">
          <p className="text-brown">
            We sent a link to <span className="font-semibold break-all text-cocoa">{sentTo}</span>. It works for an hour. When you open it you&apos;ll be signed out everywhere and can log in with the new email.
          </p>
          <div className="mt-6 flex justify-end">
            <Button onClick={() => close(false)}>Done</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4">
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Field label="New email" error={fields.email}>
            {(p) => <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false} />}
          </Field>
          <Field label="Your password" error={fields.password}>
            {(p) => <PasswordInput {...p} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />}
          </Field>
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => close(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} aria-busy={busy}>
              {busy ? "Sending…" : "Send confirmation"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
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

function DownloadData() {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      downloadJson(`fuzzball-data-${new Date().toISOString().slice(0, 10)}.json`, await account.exportData());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "We couldn't prepare your data just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mt-3 max-w-[56ch] text-brown">
        Everything we hold about you in one file: your details, addresses, orders, work orders and messages, reviews and wishlist.
      </p>
      <Button variant="secondary" className="mt-5" onClick={download} disabled={busy} aria-busy={busy}>
        {busy ? "Preparing…" : "Download my data"}
      </Button>
    </div>
  );
}

const DELETE_GRACE_DAYS = 30;

function DeleteAccount({ user }: { user: User }) {
  const { refresh } = useAuth();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestedAt = user.deletionRequestedAt ? new Date(user.deletionRequestedAt) : null;
  const deletionDate = requestedAt ? new Date(requestedAt.getTime() + DELETE_GRACE_DAYS * 86_400_000) : null;

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await account.requestAccountDeletion();
      await refresh();
      setOpen(false);
      toast.success("Deletion requested.");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await account.cancelAccountDeletion();
      await refresh();
      toast.success("Deletion cancelled. Your account stays.");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "We couldn't cancel that just now. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mt-3 max-w-[56ch] text-brown">
        Under India&apos;s Digital Personal Data Protection Act you can ask us to delete your data. We wait {DELETE_GRACE_DAYS} days in case you change your mind, then erase it.
        We keep only the bare record of past orders and payments (amounts and dates, no name or address), because tax rules require it.
      </p>
      {requestedAt && deletionDate ? (
        <div role="status" className="mt-5 rounded-[12px] bg-warn-wash px-4 py-3 text-warn">
          <p className="font-medium">
            Deletion requested on {formatDate(requestedAt.toISOString())}. We&apos;ll erase your account on or after {formatDate(deletionDate.toISOString())}.
          </p>
          <p className="mt-1 text-[15px]">If an order or refund is still in progress we wait until it is finished.</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={cancel} disabled={busy} aria-busy={busy}>
            {busy ? "Cancelling…" : "Keep my account"}
          </Button>
        </div>
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
        description={`In ${DELETE_GRACE_DAYS} days we'll erase your account and personal data. You'll lose access to your order history, work orders and saved addresses. You can change your mind before then.`}
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
