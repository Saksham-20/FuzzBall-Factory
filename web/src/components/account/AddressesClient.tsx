"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { AccountHeading } from "@/components/account/AccountShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer, Modal } from "@/components/ui/Dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/Field";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import * as account from "@/lib/api/account";
import { useApi } from "@/lib/api/useApi";
import { ApiError } from "@/lib/mock/db";
import { COUNTRIES, INDIAN_STATES } from "@/lib/status";
import type { Address } from "@/lib/types";

const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;
const actionBtn = "min-h-11 px-4";

export function AddressesClient() {
  const { data, error, loading, reload } = useApi(account.listAddresses, "my-addresses");
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [deleting, setDeleting] = useState<Address | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function makeDefault(a: Address) {
    setBusyId(a.id);
    try {
      await account.saveAddress({ ...a, isDefault: true });
      toast.success(`${a.label} is now your default address.`);
      reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "We couldn't change your default address. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <AccountHeading title="Addresses">
        <Button onClick={() => setEditing("new")}>
          <Plus strokeWidth={2} aria-hidden />
          Add address
        </Button>
      </AccountHeading>
      <p className="mt-3 max-w-[60ch] text-brown">Saved addresses fill in at checkout. Your default is picked first.</p>

      <div className="mt-8" aria-live="polite">
        {loading && !data ? (
          <ul className="grid gap-5 md:grid-cols-2" aria-label="Loading addresses">
            {[0, 1].map((i) => (
              <li key={i}>
                <Skeleton className="h-56 rounded-ticket" />
              </li>
            ))}
          </ul>
        ) : error ? (
          <ErrorNote onRetry={reload}>{error.message}</ErrorNote>
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="No saved addresses"
            action={
              <Button onClick={() => setEditing("new")}>
                <Plus strokeWidth={2} aria-hidden />
                Add your first address
              </Button>
            }
          >
            Add one now and checkout gets a lot quicker. Gifting? Save your friend&apos;s address too.
          </EmptyState>
        ) : (
          <ul className="grid gap-5 md:grid-cols-2">
            {data.map((a) => (
              <li key={a.id}>
                <Ticket head={[a.label, a.isDefault ? <Badge key="d" tone="ooak">Default</Badge> : undefined]} className="h-full px-4 pb-3">
                  <address className="font-stencil text-[13px] leading-relaxed not-italic">
                    {a.name}
                    <br />
                    {a.line1}
                    {a.line2 ? (
                      <>
                        <br />
                        {a.line2}
                      </>
                    ) : null}
                    <br />
                    {a.city}, {a.state} {a.postalCode}
                    <br />
                    {countryName(a.country)}
                    <br />
                    <span className="tabular">{a.phone}</span>
                  </address>
                  <div className="mt-3 -ml-2 flex flex-wrap gap-x-1 border-t border-dashed border-kraft-deep/60 pt-2">
                    <Button size="sm" variant="ghost" className={actionBtn} onClick={() => setEditing(a)}>
                      Edit<span className="sr-only"> {a.label}</span>
                    </Button>
                    {!a.isDefault ? (
                      <Button size="sm" variant="ghost" className={actionBtn} disabled={busyId === a.id} onClick={() => makeDefault(a)}>
                        {busyId === a.id ? "Saving…" : "Set as default"}
                        <span className="sr-only"> {a.label}</span>
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" className={actionBtn} onClick={() => setDeleting(a)}>
                      Delete<span className="sr-only"> {a.label}</span>
                    </Button>
                  </div>
                </Ticket>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddressDrawer
        target={editing}
        onClose={() => setEditing(null)}
        onSaved={(a, isNew) => {
          setEditing(null);
          toast.success(isNew ? `Saved ${a.label}.` : `Updated ${a.label}.`);
          reload();
        }}
      />
      <DeleteModal
        address={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(a) => {
          setDeleting(null);
          toast.success(`Deleted ${a.label}.`);
          reload();
        }}
      />
    </div>
  );
}

function DeleteModal({ address, onClose, onDeleted }: { address: Address | null; onClose: () => void; onDeleted: (a: Address) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Keep the last address around so the text doesn't blank while the modal fades out.
  const [last, setLast] = useState<Address | null>(null);
  if (address && address !== last) setLast(address);
  const shown = address ?? last;

  async function confirm() {
    if (!address) return;
    setBusy(true);
    setError("");
    try {
      await account.deleteAddress(address.id);
      onDeleted(address);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We couldn't delete that address. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={!!address}
      onOpenChange={(o) => {
        if (!o && !busy) {
          setError("");
          onClose();
        }
      }}
      title="Delete this address?"
      description={shown ? `${shown.label} (${shown.line1}, ${shown.city}) will be removed from your account. Past orders keep their own copy.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Keep it
          </Button>
          <Button onClick={confirm} disabled={busy} aria-busy={busy}>
            {busy ? "Deleting…" : "Delete address"}
          </Button>
        </>
      }
    >
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </Modal>
  );
}

const PHONE = /^\+?[0-9\s-]{7,16}$/;
const schema = z
  .object({
    label: z.string().trim().min(1, "Give it a short name, like Home or Office.").max(30, "Keep the name under 30 characters."),
    name: z.string().trim().min(2, "Who should the parcel be addressed to?"),
    phone: z.string().trim().regex(PHONE, "Use digits only, with the country code if it's outside India."),
    country: z.string().min(1, "Choose a country."),
    line1: z.string().trim().min(3, "Add the house, flat or building and street."),
    line2: z.string().trim(),
    city: z.string().trim().min(2, "Add the city or town."),
    state: z.string().trim().min(1, "Add the state or region."),
    postalCode: z.string().trim().min(3, "Add the postal code."),
    isDefault: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.country === "IN" && !/^[1-9][0-9]{5}$/.test(v.postalCode)) {
      ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Indian PIN codes are 6 digits, like 560038." });
    }
  });
type Values = z.infer<typeof schema>;

function toValues(a?: Address): Values {
  return {
    label: a?.label ?? "",
    name: a?.name ?? "",
    phone: a?.phone ?? "",
    country: a?.country ?? "IN",
    line1: a?.line1 ?? "",
    line2: a?.line2 ?? "",
    city: a?.city ?? "",
    state: a?.state ?? "",
    postalCode: a?.postalCode ?? "",
    isDefault: a?.isDefault ?? false,
  };
}

function AddressDrawer({ target, onClose, onSaved }: { target: Address | "new" | null; onClose: () => void; onSaved: (a: Address, isNew: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const editing = target && target !== "new" ? target : undefined;
  return (
    <Drawer
      open={target !== null}
      onOpenChange={(o) => {
        if (!o && !busy) onClose();
      }}
      title={editing ? "Edit address" : "Add address"}
      description={editing ? undefined : "We'll use it to fill in checkout."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="address-form" disabled={busy} aria-busy={busy}>
            {busy ? "Saving…" : editing ? "Save changes" : "Save address"}
          </Button>
        </>
      }
    >
      {/* Mounted only while the drawer is open, so every open starts from fresh values. */}
      <AddressFields address={editing} onBusy={setBusy} onSaved={onSaved} />
    </Drawer>
  );
}

function AddressFields({ address, onBusy, onSaved }: { address?: Address; onBusy: (b: boolean) => void; onSaved: (a: Address, isNew: boolean) => void }) {
  const [formError, setFormError] = useState("");
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: toValues(address) });
  const country = useWatch({ control, name: "country" });
  const india = country === "IN";

  async function onSubmit(v: Values) {
    setFormError("");
    onBusy(true);
    try {
      const saved = await account.saveAddress({ ...v, line2: v.line2 || undefined, id: address?.id });
      onSaved(saved, !address);
    } catch (e) {
      if (e instanceof ApiError) {
        for (const [k, msg] of Object.entries(e.fields ?? {})) if (k in v) setError(k as keyof Values, { message: msg });
      }
      setFormError(e instanceof ApiError ? e.message : "We couldn't save that address. Please try again.");
    } finally {
      onBusy(false);
    }
  }

  return (
    <form id="address-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4 pb-4">
      {formError ? <ErrorNote>{formError}</ErrorNote> : null}
      <Field label="Address name" error={errors.label?.message}>
        {(p) => <Input {...p} {...register("label")} placeholder="Home, Office, Sister's place" autoComplete="off" />}
      </Field>
      <Field label="Full name" error={errors.name?.message}>
        {(p) => <Input {...p} {...register("name")} autoComplete="name" />}
      </Field>
      <Field label="Phone" error={errors.phone?.message} hint="The courier calls this number.">
        {(p) => <Input {...p} {...register("phone")} type="tel" inputMode="tel" autoComplete="tel" placeholder={india ? "+91 98000 00000" : "+44 7700 900456"} />}
      </Field>
      <Field label="Country" error={errors.country?.message}>
        {(p) => (
          <Select {...p} {...register("country", { onChange: () => setValue("state", "") })} autoComplete="country">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Address line 1" error={errors.line1?.message}>
        {(p) => <Input {...p} {...register("line1")} autoComplete="address-line1" placeholder="House or flat number, building, street" />}
      </Field>
      <Field label="Address line 2" optional error={errors.line2?.message}>
        {(p) => <Input {...p} {...register("line2")} autoComplete="address-line2" placeholder="Area, landmark" />}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="City" error={errors.city?.message}>
          {(p) => <Input {...p} {...register("city")} autoComplete="address-level2" />}
        </Field>
        <Field label={india ? "State" : "State or region"} error={errors.state?.message}>
          {(p) =>
            india ? (
              <Select {...p} {...register("state")} autoComplete="address-level1">
                <option value="">Choose a state</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            ) : (
              <Input {...p} {...register("state")} autoComplete="address-level1" />
            )
          }
        </Field>
      </div>
      <Field label={india ? "PIN code" : "Postal code"} error={errors.postalCode?.message} className="sm:max-w-48">
        {(p) => <Input {...p} {...register("postalCode")} inputMode={india ? "numeric" : "text"} autoComplete="postal-code" maxLength={india ? 6 : 12} />}
      </Field>
      <Checkbox label="Make this my default address" {...register("isDefault")} />
    </form>
  );
}
