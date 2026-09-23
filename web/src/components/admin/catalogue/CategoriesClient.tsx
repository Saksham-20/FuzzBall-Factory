"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AdminPage, Panel, TableWrap, Td, Th } from "@/components/admin/ui";
import { ConfirmModal, ListSkeleton, slugify, useUnsavedGuard } from "@/components/admin/catalogue/kit";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorNote } from "@/components/ui/misc";
import { useApi } from "@/lib/api/useApi";
import { deleteCategory, listAdminProducts, saveCategory } from "@/lib/api/admin";
import { listCategories } from "@/lib/api/catalog";
import type { Category } from "@/lib/types";

const schema = z.object({
  name: z.string().trim().min(2, "Give the category a name.").max(40, "Keep the name under 40 characters."),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes, like keychains."),
  word: z.string().trim().min(2, "Add a short word for the big lettering.").max(14, "Keep it to 14 characters or fewer so it fits."),
  blurb: z.string().trim().max(60, "Keep the blurb under 60 characters."),
  image: z.string().trim().regex(/^(\/|https?:\/\/)\S+$/, "Use a link that starts with https:// or /."),
});
type Values = z.infer<typeof schema>;

function CategoryForm({ formId, initial, takenSlugs, onSaved, onBusy }: { formId: string; initial?: Category; takenSlugs: string[]; onSaved: () => void; onBusy: (b: boolean) => void }) {
  const { register, handleSubmit, setValue, control, setError, formState: { errors, isDirty, dirtyFields } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: initial?.name ?? "", slug: initial?.slug ?? "", word: initial?.word ?? "", blurb: initial?.blurb ?? "", image: initial?.image ?? "" },
    mode: "onTouched",
  });
  useUnsavedGuard(isDirty);
  const name = useWatch({ control, name: "name" });
  const image = useWatch({ control, name: "image" });
  const slugNow = useWatch({ control, name: "slug" });
  const slugTouched = !!dirtyFields.slug;
  useEffect(() => {
    if (!initial && !slugTouched) setValue("slug", slugify(name));
  }, [name, initial, slugTouched, setValue]);

  const submit = handleSubmit(async (v) => {
    if (!initial && takenSlugs.includes(v.slug)) {
      setError("slug", { message: "Another category already uses this address. Pick a different one." }, { shouldFocus: true });
      return;
    }
    onBusy(true);
    try {
      await saveCategory({ ...v, blurb: v.blurb });
      toast.success(`${v.name} saved.`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the category. Try again.");
    } finally {
      onBusy(false);
    }
  });

  const previewOk = /^(\/|https?:\/\/)\S+$/.test(image.trim());
  return (
    <form id={formId} onSubmit={submit} noValidate className="grid gap-4 pb-4">
      <Field label="Name" error={errors.name?.message}>
        {(p) => <Input {...p} autoComplete="off" {...register("name")} />}
      </Field>
      <Field label="Shop address" error={errors.slug?.message} hint={initial ? "Fixed once created, because shop links use it." : `Shoppers see /shop/${slugNow || "…"}`}>
        {(p) => <Input {...p} autoComplete="off" readOnly={!!initial} className={initial ? "opacity-70" : undefined} {...register("slug")} />}
      </Field>
      <Field label="Big word" error={errors.word?.message} hint="Shown in large lettering on the home page. One short word.">
        {(p) => <Input {...p} autoComplete="off" {...register("word")} />}
      </Field>
      <Field label="Blurb" optional error={errors.blurb?.message} hint="A few words under the name, like “Amigurumi friends”.">
        {(p) => <Textarea {...p} rows={2} className="min-h-20" {...register("blurb")} />}
      </Field>
      <Field label="Image link" error={errors.image?.message} hint="A photo link. Sample photos look like /samples/bear.jpg.">
        {(p) => <Input {...p} inputMode="url" autoComplete="off" {...register("image")} />}
      </Field>
      {previewOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.trim()} alt="Preview of the category image" className="h-32 w-full max-w-[16rem] rounded-[12px] bg-kraft-light object-cover" />
      ) : null}
    </form>
  );
}

export function CategoriesClient() {
  const cats = useApi(listCategories, "admin-categories");
  const prods = useApi(() => listAdminProducts(), "admin-categories-products");
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Category | null>(null);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    prods.data?.forEach((p) => m.set(p.category, (m.get(p.category) ?? 0) + 1));
    return m;
  }, [prods.data]);
  const formId = "category-form";

  const rows = cats.data ?? [];
  const reload = () => { cats.reload(); prods.reload(); };

  return (
    <AdminPage title="Categories" actions={<Button onClick={() => setEditing("new")}><Plus strokeWidth={2} /> New category</Button>}>
      {cats.error ? (
        <ErrorNote onRetry={cats.reload}>{cats.error.message || "Categories didn't load."}</ErrorNote>
      ) : cats.loading && !cats.data ? (
        <ListSkeleton rows={6} />
      ) : rows.length === 0 ? (
        <Panel>
          <EmptyState title="No categories yet" action={<Button onClick={() => setEditing("new")}>Add a category</Button>}>
            Categories group products in the shop and give the home page its big lettering.
          </EmptyState>
        </Panel>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {rows.map((c) => (
              <li key={c.slug} className="flex items-center gap-3 rounded-ticket bg-paper p-3 shadow-ticket">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.image} alt="" className="size-14 shrink-0 rounded-[10px] bg-kraft-light object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.name}</p>
                  <p className="font-stencil text-[11px] text-brown-soft">{c.slug} · {counts.get(c.slug) ?? 0} products</p>
                </div>
                <button type="button" aria-label={`Edit ${c.name}`} onClick={() => setEditing(c)} className="press grid size-11 place-items-center rounded-full text-brown"><Pencil className="size-[18px]" strokeWidth={1.8} /></button>
                <button type="button" aria-label={`Delete ${c.name}`} onClick={() => setDel(c)} className="press grid size-11 place-items-center rounded-full text-err"><Trash2 className="size-[18px]" strokeWidth={1.8} /></button>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Panel flush>
              <TableWrap>
                <caption className="sr-only">Categories</caption>
                <thead>
                  <tr><Th>Category</Th><Th>Address</Th><Th>Big word</Th><Th>Blurb</Th><Th className="text-right">Products</Th><Th><span className="sr-only">Actions</span></Th></tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.slug}>
                      <Td>
                        <span className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.image} alt="" className="size-12 shrink-0 rounded-[10px] bg-kraft-light object-cover" />
                          <span className="font-semibold">{c.name}</span>
                        </span>
                      </Td>
                      <Td className="font-stencil text-[12px] text-brown">{c.slug}</Td>
                      <Td>{c.word}</Td>
                      <Td className="text-brown">{c.blurb || <span className="text-brown-soft">None</span>}</Td>
                      <Td className="tabular text-right">{prods.data ? (counts.get(c.slug) ?? 0) : "…"}</Td>
                      <Td>
                        <span className="flex justify-end gap-1">
                          <Button variant="ghost" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}><Pencil strokeWidth={1.8} /> Edit</Button>
                          <Button variant="ghost" className="text-err" onClick={() => setDel(c)} aria-label={`Delete ${c.name}`}><Trash2 strokeWidth={1.8} /> Delete</Button>
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
        title={editing === "new" ? "New category" : "Edit category"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button type="submit" form={formId} disabled={saving}>{saving ? "Saving…" : "Save category"}</Button>
          </>
        }
      >
        {editing ? (
          <CategoryForm
            key={editing === "new" ? "new" : editing.slug}
            formId={formId}
            initial={editing === "new" ? undefined : editing}
            takenSlugs={rows.map((c) => c.slug)}
            onBusy={setSaving}
            onSaved={() => { setEditing(null); reload(); }}
          />
        ) : null}
      </Drawer>

      <ConfirmModal
        open={del !== null}
        onOpenChange={(o) => !o && setDel(null)}
        title={`Delete ${del?.name ?? "category"}?`}
        description="This removes the category from the shop and the home page. It can't be undone. Categories that still have products can't be deleted."
        confirmLabel="Delete category"
        onConfirm={async () => {
          if (!del) return;
          await deleteCategory(del.slug);
          toast.success(`${del.name} deleted.`);
          reload();
        }}
      />
    </AdminPage>
  );
}
