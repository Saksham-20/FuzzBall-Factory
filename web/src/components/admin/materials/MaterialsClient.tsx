"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Archive, Pencil, Plus } from "lucide-react";
import { AdminPage, Panel, TableWrap, Td, Th } from "@/components/admin/ui";
import { ConfirmModal, ListSkeleton, useUnsavedGuard } from "@/components/admin/catalogue/kit";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorNote } from "@/components/ui/misc";
import { useApi } from "@/lib/api/useApi";
import { archiveMaterial, listMaterials, saveMaterial } from "@/lib/api/admin";
import { formatINR } from "@/lib/format";
import { SITE } from "@/lib/site";
import type { Material } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(1, "Give it a name."),
  unit: z.string().trim().min(1, "e.g. skein, gram, piece, metre."),
  costPerUnit: z.string().trim().refine((v) => v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0, "Enter an amount, 0 or more."),
  qtyOnHand: z.string().trim().refine((v) => v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0, "Enter a quantity, 0 or more."),
  lowStockAt: z.string().trim().refine((v) => v === "" || (Number.isFinite(Number(v)) && Number(v) >= 0), "Enter a quantity, or leave empty for no threshold."),
  notes: z.string().trim().max(500, "Keep it under 500 characters."),
});
type Values = z.infer<typeof schema>;

/** Trims a trailing ".0" but keeps real decimals, so "2" and "4.5" both read naturally. */
export const formatQty = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
export const pluralUnit = (unit: string, n: number) => `${unit}${n === 1 ? "" : "s"}`;
export const isRunningLow = (m: Pick<Material, "qtyOnHand" | "lowStockAt">) => m.lowStockAt != null && m.qtyOnHand <= m.lowStockAt;

function MaterialForm({ formId, initial, onSaved, onBusy }: { formId: string; initial?: Material; onSaved: () => void; onBusy: (b: boolean) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      unit: initial?.unit ?? "",
      costPerUnit: initial ? String(initial.costPerUnit) : "",
      qtyOnHand: initial ? String(initial.qtyOnHand) : "",
      lowStockAt: initial?.lowStockAt != null ? String(initial.lowStockAt) : "",
      notes: initial?.notes ?? "",
    },
    mode: "onTouched",
  });
  useUnsavedGuard(isDirty);

  const submit = handleSubmit(async (v) => {
    onBusy(true);
    try {
      await saveMaterial({
        id: initial?.id,
        name: v.name,
        unit: v.unit,
        costPerUnit: Math.round(Number(v.costPerUnit)),
        qtyOnHand: Number(v.qtyOnHand),
        lowStockAt: v.lowStockAt ? Number(v.lowStockAt) : undefined,
        notes: v.notes || undefined,
        archived: initial?.archived ?? false,
        sample: initial?.sample,
      });
      toast.success(`${v.name} saved.`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save that material. Try again.");
    } finally {
      onBusy(false);
    }
  });

  return (
    <form id={formId} onSubmit={submit} noValidate className="grid gap-4 pb-4">
      <Field label="Name" error={errors.name?.message} hint='e.g. "Cotton yarn, cream, 100g skein".'>
        {(p) => <Input {...p} autoComplete="off" {...register("name")} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Unit" error={errors.unit?.message} hint="skein, gram, piece, metre…">
          {(p) => <Input {...p} autoComplete="off" {...register("unit")} />}
        </Field>
        <Field label="Cost per unit (₹)" error={errors.costPerUnit?.message}>
          {(p) => <Input {...p} inputMode="decimal" className="tabular" {...register("costPerUnit")} />}
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Qty on hand" error={errors.qtyOnHand?.message} hint="Fractions are fine, e.g. 4.5.">
          {(p) => <Input {...p} inputMode="decimal" className="tabular" {...register("qtyOnHand")} />}
        </Field>
        <Field label="Running-low threshold" optional error={errors.lowStockAt?.message} hint="Flag it once qty drops to this or below.">
          {(p) => <Input {...p} inputMode="decimal" className="tabular" {...register("lowStockAt")} />}
        </Field>
      </div>
      <Field label="Notes" optional error={errors.notes?.message} hint="Supplier, colour code, anything worth remembering.">
        {(p) => <Textarea {...p} rows={3} {...register("notes")} />}
      </Field>
    </form>
  );
}

export function MaterialsClient() {
  const { data, error, loading, reload } = useApi(listMaterials, "admin-materials");
  const [editing, setEditing] = useState<Material | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [toArchive, setToArchive] = useState<Material | null>(null);
  const formId = "material-form";

  const rows = data ?? [];

  const nameCell = (m: Material) => (
    <span className="flex flex-wrap items-center gap-1.5">
      <span className="font-semibold">{m.name}</span>
      {SITE.useMock && m.sample ? <Badge tone="sample">Sample</Badge> : null}
      {isRunningLow(m) ? <Badge tone="mto">Running low</Badge> : null}
    </span>
  );

  return (
    <AdminPage title="Materials" actions={<Button onClick={() => setEditing("new")}><Plus strokeWidth={2} /> Add material</Button>}>
      <p className="max-w-[62ch] text-brown">
        Keep a running count of what you have on hand — yarn, stuffing, safety eyes, packaging, whatever you stock —
        so you can pick real numbers into the price calculator instead of retyping them each time.
      </p>
      {error ? (
        <ErrorNote onRetry={reload}>{error.message || "Materials didn't load."}</ErrorNote>
      ) : loading && !data ? (
        <ListSkeleton rows={4} />
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState title="No materials yet" action={<Button onClick={() => setEditing("new")}>Add your first material</Button>}>
            Add the yarn, notions and packaging you keep in stock so the price calculator can pick real costs and
            quantities from here.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <ul className="relative space-y-3 md:hidden" data-placeholder={SITE.useMock && rows.some((m) => m.sample) ? "materials-catalogue" : undefined}>
            {rows.map((m) => (
              <li key={m.id} className="rounded-ticket bg-paper p-4 shadow-ticket">
                {nameCell(m)}
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brown">
                  <span className="tabular">{formatINR(m.costPerUnit)} / {m.unit}</span>
                  <span className="tabular">{formatQty(m.qtyOnHand)} {pluralUnit(m.unit, m.qtyOnHand)} on hand</span>
                </p>
                {m.notes ? <p className="mt-1 text-sm text-brown-soft">{m.notes}</p> : null}
                <div className="mt-2 flex gap-1">
                  <Button variant="ghost" onClick={() => setEditing(m)}><Pencil strokeWidth={1.8} /> Edit</Button>
                  <Button variant="ghost" className="text-err" onClick={() => setToArchive(m)}><Archive strokeWidth={1.8} /> Archive</Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="relative hidden md:block" data-placeholder={SITE.useMock && rows.some((m) => m.sample) ? "materials-catalogue" : undefined}>
            <Panel flush>
              <TableWrap>
                <caption className="sr-only">Materials</caption>
                <thead>
                  <tr><Th>Name</Th><Th>Unit</Th><Th className="text-right">Cost / unit</Th><Th className="text-right">Qty on hand</Th><Th><span className="sr-only">Actions</span></Th></tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <Td>{nameCell(m)}</Td>
                      <Td className="text-brown">{m.unit}</Td>
                      <Td className="tabular text-right">{formatINR(m.costPerUnit)}</Td>
                      <Td className="tabular text-right">{formatQty(m.qtyOnHand)}</Td>
                      <Td>
                        <span className="flex justify-end gap-1">
                          <Button variant="ghost" onClick={() => setEditing(m)} aria-label={`Edit ${m.name}`}><Pencil strokeWidth={1.8} /> Edit</Button>
                          <Button variant="ghost" className="text-err" onClick={() => setToArchive(m)} aria-label={`Archive ${m.name}`}><Archive strokeWidth={1.8} /> Archive</Button>
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
        title={editing === "new" ? "Add material" : "Edit material"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button type="submit" form={formId} disabled={saving}>{saving ? "Saving…" : "Save material"}</Button>
          </>
        }
      >
        {editing ? (
          <MaterialForm
            key={editing === "new" ? "new" : editing.id}
            formId={formId}
            initial={editing === "new" ? undefined : editing}
            onBusy={setSaving}
            onSaved={() => { setEditing(null); reload(); }}
          />
        ) : null}
      </Drawer>

      <ConfirmModal
        open={toArchive !== null}
        onOpenChange={(o) => !o && setToArchive(null)}
        title={`Archive ${toArchive?.name ?? "material"}?`}
        description="It disappears from this list and from the price calculator's picker. Past prices already logged from it don't change."
        confirmLabel="Archive material"
        onConfirm={async () => {
          if (!toArchive) return;
          await archiveMaterial(toArchive.id);
          toast.success(`${toArchive.name} archived.`);
          reload();
        }}
      />
    </AdminPage>
  );
}
