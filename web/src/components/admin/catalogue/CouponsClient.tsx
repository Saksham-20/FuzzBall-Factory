"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AdminPage, Panel, TableWrap, Td, Th } from "@/components/admin/ui";
import { ConfirmModal, ListSkeleton, Switch, useUnsavedGuard } from "@/components/admin/catalogue/kit";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Checkbox, Field, Input, Select } from "@/components/ui/Field";
import { EmptyState, ErrorNote } from "@/components/ui/misc";
import { useApi } from "@/lib/api/useApi";
import { deleteCoupon, listCoupons, saveCoupon } from "@/lib/api/admin";
import { formatDate, formatINR } from "@/lib/format";
import type { Coupon } from "@/lib/types";

const schema = z
  .object({
    code: z.string().trim().regex(/^[A-Za-z0-9_-]{3,20}$/, "Use 3 to 20 letters, numbers, dashes or underscores. No spaces."),
    kind: z.enum(["PERCENT", "FLAT"]),
    value: z.string().trim().refine((v) => v !== "" && Number.isFinite(Number(v)) && Number(v) > 0, "Enter an amount above 0."),
    minCart: z.string().trim().refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), "Enter an amount, or leave empty for no minimum."),
    expiresAt: z.string(),
    active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "PERCENT" && Number(v.value) > 100) ctx.addIssue({ code: "custom", path: ["value"], message: "A percentage can't be more than 100." });
  });
type Values = z.infer<typeof schema>;

const isExpired = (c: Coupon) => !!c.expiresAt && new Date(c.expiresAt) < new Date();
const describe = (c: Coupon) => (c.kind === "PERCENT" ? `${c.value}% off` : `${formatINR(c.value)} off`);
const localDate = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const todayStr = () => localDate(new Date().toISOString());

function CouponForm({ formId, initial, takenCodes, onSaved, onBusy }: { formId: string; initial?: Coupon; takenCodes: string[]; onSaved: () => void; onBusy: (b: boolean) => void }) {
  const { register, handleSubmit, control, setError, formState: { errors, isDirty } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { code: initial?.code ?? "", kind: initial?.kind ?? "PERCENT", value: initial ? String(initial.value) : "", minCart: initial?.minCart ? String(initial.minCart) : "", expiresAt: localDate(initial?.expiresAt), active: initial?.active ?? true },
    mode: "onTouched",
  });
  useUnsavedGuard(isDirty);
  const kind = useWatch({ control, name: "kind" });

  const submit = handleSubmit(async (v) => {
    const code = v.code.toUpperCase();
    if (!initial && takenCodes.includes(code)) {
      setError("code", { message: "That code already exists. Edit it from the list instead." }, { shouldFocus: true });
      return;
    }
    if (v.expiresAt && v.expiresAt < todayStr() && v.expiresAt !== localDate(initial?.expiresAt)) {
      setError("expiresAt", { message: "That date has already passed. Pick today or later, or leave it empty." }, { shouldFocus: true });
      return;
    }
    onBusy(true);
    try {
      await saveCoupon({
        code, kind: v.kind, value: Number(v.value), minCart: v.minCart ? Number(v.minCart) : 0, active: v.active,
        uses: initial?.uses ?? 0,
        expiresAt: v.expiresAt ? (v.expiresAt === localDate(initial?.expiresAt) && initial?.expiresAt ? initial.expiresAt : new Date(`${v.expiresAt}T23:59:59`).toISOString()) : undefined,
      });
      toast.success(`${code} saved.`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the coupon. Try again.");
    } finally {
      onBusy(false);
    }
  });

  return (
    <form id={formId} onSubmit={submit} noValidate className="grid gap-4 pb-4">
      <Field label="Code" error={errors.code?.message} hint={initial ? "The code can't change. Make a new coupon for a new code." : "What shoppers type at checkout. Capitals and numbers are easiest."}>
        {(p) => <Input {...p} autoComplete="off" autoCapitalize="characters" readOnly={!!initial} className={initial ? "font-stencil opacity-70" : "font-stencil"} {...register("code")} />}
      </Field>
      <Field label="Type">
        {(p) => (
          <Select {...p} {...register("kind")}>
            <option value="PERCENT">Percent off the cart</option>
            <option value="FLAT">Flat amount off the cart</option>
          </Select>
        )}
      </Field>
      <Field label={kind === "PERCENT" ? "Percent off" : "Rupees off (₹)"} error={errors.value?.message}>
        {(p) => <Input {...p} inputMode="numeric" className="tabular" {...register("value")} />}
      </Field>
      <Field label="Minimum cart (₹)" optional error={errors.minCart?.message} hint="The coupon only works when the items add up to at least this much.">
        {(p) => <Input {...p} inputMode="numeric" className="tabular" {...register("minCart")} />}
      </Field>
      <Field label="Last day it works" optional error={errors.expiresAt?.message} hint="Leave empty for a coupon that doesn't expire.">
        {(p) => <Input {...p} type="date" {...register("expiresAt")} />}
      </Field>
      <Checkbox label="Active. Shoppers can use it now." {...register("active")} />
      {initial ? <p className="text-sm text-brown">Used {initial.uses} {initial.uses === 1 ? "time" : "times"} so far.</p> : null}
    </form>
  );
}

export function CouponsClient() {
  const { data, error, loading, reload } = useApi(listCoupons, "admin-coupons");
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Coupon | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const formId = "coupon-form";

  async function toggle(c: Coupon, active: boolean) {
    setToggling(c.code);
    try {
      await saveCoupon({ ...c, active });
      toast.success(`${c.code} is now ${active ? "active" : "off"}.`);
      reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't change that coupon. Try again.");
    } finally {
      setToggling(null);
    }
  }

  const rows = data ?? [];
  const status = (c: Coupon) => (isExpired(c) ? <Badge tone="sold">Expired</Badge> : null);
  const expiry = (c: Coupon) => (c.expiresAt ? formatDate(c.expiresAt, { day: "numeric", month: "short", year: "numeric" }) : "Never");

  return (
    <AdminPage title="Coupons" actions={<Button onClick={() => setEditing("new")}><Plus strokeWidth={2} /> New coupon</Button>}>
      {error ? (
        <ErrorNote onRetry={reload}>{error.message || "Coupons didn't load."}</ErrorNote>
      ) : loading && !data ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState title="No coupons yet" action={<Button onClick={() => setEditing("new")}>Create a coupon</Button>}>
            Coupons give a percentage or a flat amount off at checkout.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {rows.map((c) => (
              <li key={c.code} className="rounded-ticket bg-paper p-4 shadow-ticket">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-stencil text-[15px]">{c.code}</p>
                  <Switch checked={c.active} onChange={(v) => toggle(c, v)} label={`${c.code} active`} disabled={toggling === c.code} />
                </div>
                <p className="mt-0.5 font-semibold">{describe(c)}{c.minCart ? <span className="font-normal text-brown"> on {formatINR(c.minCart)} or more</span> : null}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brown">
                  <span className="tabular">Used {c.uses}×</span><span>Expires: {expiry(c)}</span>{status(c)}
                </p>
                <div className="mt-2 flex gap-1">
                  <Button variant="ghost" onClick={() => setEditing(c)}><Pencil strokeWidth={1.8} /> Edit {c.code}</Button>
                  <Button variant="ghost" className="text-err" onClick={() => setDel(c)}><Trash2 strokeWidth={1.8} /> Delete</Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Panel flush>
              <TableWrap>
                <caption className="sr-only">Coupons</caption>
                <thead>
                  <tr><Th>Code</Th><Th>Discount</Th><Th className="text-right">Minimum cart</Th><Th className="text-right">Used</Th><Th>Expires</Th><Th>Active</Th><Th><span className="sr-only">Actions</span></Th></tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.code}>
                      <Td className="font-stencil text-[13px]">{c.code}</Td>
                      <Td className="font-semibold whitespace-nowrap">{describe(c)}</Td>
                      <Td className="tabular text-right">{c.minCart ? formatINR(c.minCart) : "None"}</Td>
                      <Td className="tabular text-right">{c.uses}</Td>
                      <Td className="whitespace-nowrap"><span className="mr-2">{expiry(c)}</span>{status(c)}</Td>
                      <Td><Switch checked={c.active} onChange={(v) => toggle(c, v)} label={`${c.code} active`} disabled={toggling === c.code} /></Td>
                      <Td>
                        <span className="flex justify-end gap-1">
                          <Button variant="ghost" onClick={() => setEditing(c)} aria-label={`Edit ${c.code}`}><Pencil strokeWidth={1.8} /> Edit</Button>
                          <Button variant="ghost" className="text-err" onClick={() => setDel(c)} aria-label={`Delete ${c.code}`}><Trash2 strokeWidth={1.8} /> Delete</Button>
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Panel>
          </div>
        </>
      )}

      <Drawer
        open={editing !== null}
        onOpenChange={(o) => !o && !saving && setEditing(null)}
        title={editing === "new" ? "New coupon" : "Edit coupon"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button type="submit" form={formId} disabled={saving}>{saving ? "Saving…" : "Save coupon"}</Button>
          </>
        }
      >
        {editing ? (
          <CouponForm
            key={editing === "new" ? "new" : editing.code}
            formId={formId}
            initial={editing === "new" ? undefined : editing}
            takenCodes={rows.map((c) => c.code)}
            onBusy={setSaving}
            onSaved={() => { setEditing(null); reload(); }}
          />
        ) : null}
      </Drawer>

      <ConfirmModal
        open={del !== null}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete ${del?.code ?? "coupon"}?`}
        description="Shoppers can no longer use this code. Past orders that used it keep their discount. To pause it instead, switch it off."
        confirmLabel="Delete coupon"
        onConfirm={async () => {
          if (!del) return;
          await deleteCoupon(del.code);
          toast.success(`${del.code} deleted.`);
          reload();
        }}
      />
    </AdminPage>
  );
}
