"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Calculator, ChevronLeft, ExternalLink, Info, Plus, Trash2 } from "lucide-react";
import { AdminPage, Panel } from "@/components/admin/ui";
import { slugify, useUnsavedGuard } from "@/components/admin/catalogue/kit";
import { PriceCalculator } from "@/components/admin/pricing/PriceCalculator";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { Checkbox, Field, Input, Radio, Select, Textarea } from "@/components/ui/Field";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { EmptyState, ErrorNote, Skeleton } from "@/components/ui/misc";
import { useApi } from "@/lib/api/useApi";
import { getAdminProduct, saveProduct } from "@/lib/api/admin";
import { listCategories } from "@/lib/api/catalog";
import { ApiError } from "@/lib/mock/db";
import { OCCASIONS } from "@/lib/status";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Category, Product } from "@/lib/types";

/* ───────── form model: every number is a string in the form and converted on save ───────── */

interface NumOpts {
  min?: number;
  max?: number;
  int?: boolean;
  optional?: boolean;
}

const num = (msg: string, o: NumOpts = {}) =>
  z.string().trim().superRefine((v, ctx) => {
    if (v === "") {
      if (!o.optional) ctx.addIssue({ code: "custom", message: msg });
      return;
    }
    const n = Number(v);
    if (!Number.isFinite(n)) return void ctx.addIssue({ code: "custom", message: msg });
    if (o.int && !Number.isInteger(n)) return void ctx.addIssue({ code: "custom", message: "Use a whole number." });
    if (o.min !== undefined && n < o.min) return void ctx.addIssue({ code: "custom", message: `Must be ${o.min} or more.` });
    if (o.max !== undefined && n > o.max) return void ctx.addIssue({ code: "custom", message: `Must be ${o.max} or less.` });
  });

const schema = z
  .object({
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    name: z.string().trim().min(2, "Give it a name of at least 2 letters.").max(80, "Keep the name under 80 characters."),
    tagline: z.string().trim().max(120, "Keep the tagline under 120 characters."),
    description: z.string().trim().min(10, "Write a sentence or two a shopper can read."),
    category: z.string().min(1, "Choose a category."),
    images: z.array(z.object({ src: z.string(), alt: z.string() })).min(1, "Add at least one photo. The first one is the cover."),
    price: num("Enter a price in rupees.", { min: 1 }),
    compareAtPrice: num("Enter a price in rupees, or leave it empty.", { min: 0, optional: true }),
    fulfilment: z.enum(["READY", "MADE_TO_ORDER"]),
    leadTimeDays: num("Enter a number of days, like 5.", { min: 0, max: 120, int: true }),
    isOneOfAKind: z.boolean(),
    customizable: z.boolean(),
    giftable: z.boolean(),
    variants: z
      .array(
        z.object({
          vid: z.string(),
          colour: z.string().trim().min(1, "Name the colour."),
          size: z.string().trim(),
          priceDelta: num("Enter a number, or 0."),
          stock: num("Enter a count, or 0.", { min: 0, int: true }),
        }),
      )
      .min(1, "Add at least one variant."),
    swatches: z.array(z.object({ name: z.string().trim().min(1, "Name the colour."), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour.") })),
    fiber: z.string().trim(),
    sizeCm: z.string().trim(),
    weightG: num("Enter grams, like 120.", { min: 0, optional: true }),
    care: z.string(),
    occasions: z.array(z.string()),
    tags: z.string(),
  })
  .superRefine((v, ctx) => {
    const price = Number(v.price);
    const cmp = Number(v.compareAtPrice);
    if (v.compareAtPrice.trim() !== "" && Number.isFinite(price) && Number.isFinite(cmp) && cmp <= price) {
      ctx.addIssue({ code: "custom", path: ["compareAtPrice"], message: "Compare-at must be higher than the price, or leave it empty." });
    }
    if (v.isOneOfAKind && v.variants.reduce((s, x) => s + (Number(x.stock) || 0), 0) > 1) {
      ctx.addIssue({ code: "custom", path: ["variants"], message: "A one-of-a-kind piece can only have 1 in stock in total." });
    }
  });

type FormValues = z.infer<typeof schema>;

const newId = () => `v-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function toDefaults(p?: Product): FormValues {
  if (!p) {
    return {
      status: "DRAFT", name: "", tagline: "", description: "", category: "",
      images: [], price: "", compareAtPrice: "", fulfilment: "READY", leadTimeDays: "2",
      isOneOfAKind: false, customizable: true, giftable: true,
      variants: [{ vid: newId(), colour: "", size: "", priceDelta: "0", stock: "1" }],
      swatches: [], fiber: "", sizeCm: "", weightG: "", care: "", occasions: [], tags: "",
    };
  }
  return {
    status: p.status, name: p.name, tagline: p.tagline, description: p.description, category: p.category,
    images: p.images.map((i) => ({ src: i.src, alt: i.alt })),
    price: String(p.price), compareAtPrice: p.compareAtPrice ? String(p.compareAtPrice) : "",
    fulfilment: p.fulfilment, leadTimeDays: String(p.leadTimeDays),
    isOneOfAKind: p.isOneOfAKind, customizable: p.customizable, giftable: p.giftable,
    variants: p.variants.map((v) => ({ vid: v.id, colour: v.colour, size: v.size ?? "", priceDelta: String(v.priceDelta), stock: String(v.stock) })),
    swatches: p.swatches.map((s) => ({ name: s.name, hex: s.hex })),
    fiber: p.fiber, sizeCm: p.sizeCm, weightG: p.weightG ? String(p.weightG) : "",
    care: p.care.join("\n"), occasions: p.occasions, tags: p.tags.join(", "),
  };
}

function toInput(v: FormValues, p?: Product) {
  return {
    ...(p ? { id: p.id, slug: p.slug, rating: p.rating } : {}),
    name: v.name.trim(),
    tagline: v.tagline.trim(),
    description: v.description.trim(),
    category: v.category,
    price: Number(v.price),
    compareAtPrice: v.compareAtPrice.trim() ? Number(v.compareAtPrice) : undefined,
    fulfilment: v.fulfilment,
    leadTimeDays: Number(v.leadTimeDays),
    fiber: v.fiber.trim(),
    sizeCm: v.sizeCm.trim(),
    weightG: v.weightG.trim() ? Number(v.weightG) : 0,
    care: v.care.split("\n").map((l) => l.trim()).filter(Boolean),
    images: v.images.map((i) => ({ src: i.src, alt: i.alt.trim() || v.name.trim() })),
    swatches: v.swatches.map((s) => ({ name: s.name.trim(), hex: s.hex })),
    variants: v.variants.map((x) => ({ id: x.vid, colour: x.colour.trim(), size: x.size.trim() || undefined, priceDelta: Number(x.priceDelta), stock: Number(x.stock) })),
    isOneOfAKind: v.isOneOfAKind,
    customizable: v.customizable,
    giftable: v.giftable,
    occasions: v.occasions,
    tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
    status: v.status,
  };
}

const MAX_IMAGES = 8;

/* ───────── pieces ───────── */

const iconBtn =
  "press grid size-11 shrink-0 place-items-center rounded-full text-brown transition-colors duration-150 disabled:pointer-events-none disabled:opacity-35 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/8";

function ImagesField({ value, onChange, error }: { value: FormValues["images"]; onChange: (v: FormValues["images"]) => void; error?: string }) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const room = MAX_IMAGES - value.length;
  return (
    <div>
      {value.length ? (
        <ol className="mb-4 divide-y divide-line">
          {value.map((img, i) => (
            <li key={`${i}-${img.src.slice(-24)}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt="" className="size-16 shrink-0 rounded-[10px] bg-kraft-light object-cover" />
              <div className="min-w-[10rem] flex-1">
                <Field label={i === 0 ? "Cover photo description" : `Photo ${i + 1} description`} className="[&>label]:mb-1 [&>label]:text-xs">
                  {(f) => <Input {...f} className="h-11" value={img.alt} placeholder="What a shopper who can't see it needs to know" onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />}
                </Field>
              </div>
              <div className="flex items-center">
                <button type="button" className={iconBtn} aria-label={`Move photo ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-[18px]" strokeWidth={1.8} /></button>
                <button type="button" className={iconBtn} aria-label={`Move photo ${i + 1} down`} disabled={i === value.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-[18px]" strokeWidth={1.8} /></button>
                <button type="button" className={iconBtn} aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(value.filter((_, j) => j !== i))}><Trash2 className="size-[18px]" strokeWidth={1.8} /></button>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {room > 0 ? (
        <ImageUploader value={[]} max={room} label={value.length ? "Add more photos" : "Add photos"} hint={`JPG, PNG, WebP or HEIC, up to ${MAX_IMAGES} photos. The first is the cover shown in the shop.`} onChange={(urls) => onChange([...value, ...urls.map((src) => ({ src, alt: "" }))])} />
      ) : (
        <p className="text-sm text-brown">That&apos;s the maximum of {MAX_IMAGES} photos. Remove one to add another.</p>
      )}
      {error ? <p role="alert" className="mt-2 text-sm font-medium text-err">{error}</p> : null}
    </div>
  );
}

function rootMessage(e: unknown): string | undefined {
  const x = e as { message?: string; root?: { message?: string } } | undefined;
  return x?.root?.message ?? x?.message;
}

function VariantsField({ control, register, errors, ooak, fulfilment }: { control: Control<FormValues>; register: UseFormRegister<FormValues>; errors: FieldErrors<FormValues>; ooak: boolean; fulfilment: FormValues["fulfilment"] }) {
  const { fields, append, remove } = useFieldArray({ control, name: "variants" });
  const cell = "md:[&>label]:sr-only [&>label]:mb-1 [&>label]:text-xs";
  return (
    <div>
      <div aria-hidden className="font-stencil mb-1 hidden gap-3 px-0.5 text-[11px] text-brown-soft md:grid md:grid-cols-[1.4fr_1fr_1fr_1fr_44px]">
        <span>Colour</span><span>Size</span><span>Price change (₹)</span><span>In stock</span><span />
      </div>
      <ul className="divide-y divide-line">
        {fields.map((f, i) => {
          const e = errors.variants?.[i];
          return (
            <li key={f.id} className="grid grid-cols-2 gap-x-3 gap-y-2 py-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_44px] md:items-start">
              <Field label={`Variant ${i + 1} colour`} error={e?.colour?.message} className={cn("col-span-2 md:col-span-1", cell)}>
                {(p) => <Input {...p} className="h-11" placeholder="Cherry" {...register(`variants.${i}.colour`)} />}
              </Field>
              <Field label={`Variant ${i + 1} size`} error={e?.size?.message} className={cell}>
                {(p) => <Input {...p} className="h-11" placeholder="Optional" {...register(`variants.${i}.size`)} />}
              </Field>
              <Field label={`Variant ${i + 1} price change in rupees`} error={e?.priceDelta?.message} className={cell}>
                {(p) => <Input {...p} className="tabular h-11" inputMode="text" placeholder="0" {...register(`variants.${i}.priceDelta`)} />}
              </Field>
              <Field label={`Variant ${i + 1} in stock`} error={e?.stock?.message} className={cn("col-span-2 md:col-span-1", cell)}>
                {(p) => <Input {...p} className="tabular h-11" inputMode="numeric" placeholder="1" {...register(`variants.${i}.stock`)} />}
              </Field>
              <div className="col-span-2 flex justify-end md:col-span-1 md:pt-0.5">
                <button type="button" className={iconBtn} aria-label={`Remove variant ${i + 1}`} disabled={fields.length === 1} onClick={() => remove(i)}>
                  <Trash2 className="size-[18px]" strokeWidth={1.8} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {rootMessage(errors.variants) ? <p role="alert" className="mt-1 text-sm font-medium text-err">{rootMessage(errors.variants)}</p> : null}
      <p className="mt-2 text-sm text-brown">
        {ooak
          ? "A one-of-a-kind piece needs one variant with 1 in stock. It sells out on its own."
          : fulfilment === "MADE_TO_ORDER"
            ? "Made-to-order pieces don't run out, so leave stock at 99."
            : "Stock is what's on the shelf right now, per colour and size."}
      </p>
      <Button type="button" variant="secondary" className="mt-3" onClick={() => append({ vid: newId(), colour: "", size: "", priceDelta: "0", stock: fulfilment === "MADE_TO_ORDER" ? "99" : "1" })}>
        <Plus strokeWidth={2} /> Add a variant
      </Button>
    </div>
  );
}

function SwatchesField({ control, register, errors, variantColours }: { control: Control<FormValues>; register: UseFormRegister<FormValues>; errors: FieldErrors<FormValues>; variantColours: string[] }) {
  const { fields, append, remove } = useFieldArray({ control, name: "swatches" });
  const watched = useWatch({ control, name: "swatches" });
  const named = new Set((watched ?? []).map((s) => s.name.trim().toLowerCase()));
  const missing = [...new Set(variantColours.map((c) => c.trim()).filter(Boolean))].filter((c) => !named.has(c.toLowerCase()));
  return (
    <div>
      {fields.length ? (
        <ul className="divide-y divide-line">
          {fields.map((f, i) => (
            <li key={f.id} className="flex items-start gap-3 py-2.5">
              <input type="color" aria-label={`Swatch ${i + 1} colour picker`} className="mt-0.5 h-11 w-14 shrink-0 cursor-pointer rounded-[12px] border-[1.5px] border-line-strong bg-paper p-1" {...register(`swatches.${i}.hex`)} />
              <Field label={`Swatch ${i + 1} name`} error={errors.swatches?.[i]?.name?.message ?? errors.swatches?.[i]?.hex?.message} className="min-w-0 flex-1 [&>label]:sr-only">
                {(p) => <Input {...p} className="h-11" placeholder="Dusty rose" {...register(`swatches.${i}.name`)} />}
              </Field>
              <button type="button" className={iconBtn} aria-label={`Remove swatch ${i + 1}`} onClick={() => remove(i)}><Trash2 className="size-[18px]" strokeWidth={1.8} /></button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-brown">No colour dots yet. The product page shows one dot per swatch.</p>
      )}
      {missing.length ? <p className="mt-2 flex items-start gap-2 text-sm text-warn"><Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />No swatch for {missing.join(", ")}. Give each variant colour a swatch with the same name so shoppers can pick it.</p> : null}
      <Button type="button" variant="secondary" className="mt-3" onClick={() => append({ name: "", hex: "#f1e4d3" })}>
        <Plus strokeWidth={2} /> Add a swatch
      </Button>
    </div>
  );
}

/* ───────── the form ───────── */

function ProductForm({ product, categories }: { product?: Product; categories: Category[] }) {
  const router = useRouter();
  const [current, setCurrent] = useState<Product | undefined>(product);
  const defaults = useMemo(() => toDefaults(current), [current]);
  const [calcOpen, setCalcOpen] = useState(false);
  const { register, control, handleSubmit, reset, setError, setValue, formState: { errors, isDirty, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
    mode: "onTouched",
  });
  useUnsavedGuard(isDirty);

  const fulfilment = useWatch({ control, name: "fulfilment" });
  const ooak = useWatch({ control, name: "isOneOfAKind" });
  const name = useWatch({ control, name: "name" });
  const price = useWatch({ control, name: "price" });
  const variantColours = (useWatch({ control, name: "variants" }) ?? []).map((v) => v.colour);
  const occasionOptions = useMemo(() => [...new Set<string>([...OCCASIONS, ...(current?.occasions ?? [])])], [current]);
  const slug = current?.slug ?? (slugify(name) || "your-product-name");
  const priceNum = Number(price);

  const onSubmit = handleSubmit(
    async (v) => {
      try {
        const saved = await saveProduct(toInput(v, current));
        toast.success(`${saved.name} saved.`);
        if (current) {
          setCurrent(saved);
          reset(toDefaults(saved));
        } else {
          reset(toDefaults(saved));
          router.replace(`/admin/products/${saved.id}`);
        }
      } catch (e) {
        if (e instanceof ApiError) {
          Object.entries(e.fields ?? {}).forEach(([k, m]) => {
            if (k in v) setError(k as keyof FormValues, { message: m === "Already used" ? "Another product already uses this name. Pick a different one." : m }, { shouldFocus: true });
          });
          toast.error(e.message);
        } else {
          toast.error("Couldn't save the product. Check your connection and try again.");
        }
      }
    },
    () => toast.error("A few fields need attention. They're marked below."),
  );

  return (
    <>
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div>
        <Link href="/admin/products" className="press mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brown underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">
          <ChevronLeft className="size-4" strokeWidth={2} /> All products
        </Link>
      </div>
      <AdminPage
        title={current ? current.name : "New product"}
        actions={
          current && current.status === "PUBLISHED" ? (
            <Button asChild variant="secondary"><Link href={`/p/${current.slug}`} target="_blank" rel="noreferrer">View in shop <ExternalLink strokeWidth={1.8} /></Link></Button>
          ) : undefined
        }
      >
        {current?.sample ? (
          <p className="flex items-start gap-2 rounded-[12px] bg-butter/40 px-4 py-3 text-[15px]">
            <Info className="mt-0.5 size-4 shrink-0" strokeWidth={1.8} />
            <span><Badge tone="sample" className="mr-1.5 align-middle">Sample</Badge>This is stand-in catalogue data. Saving your edits turns it into a real listing.</span>
          </p>
        ) : null}

        <div className="grid gap-4">
          <Panel title="Visibility">
            <div className="grid gap-4 md:grid-cols-2 md:items-end">
              <Field label="Status" hint="Only published products appear in the shop.">
                {(p) => (
                  <Select {...p} {...register("status")}>
                    <option value="DRAFT">Draft: hidden from the shop</option>
                    <option value="PUBLISHED">Published: visible in the shop</option>
                    <option value="ARCHIVED">Archived: hidden, kept for records</option>
                  </Select>
                )}
              </Field>
            </div>
          </Panel>

          <Panel title="Basics">
            <div className="grid gap-4">
              <Field label="Name" error={errors.name?.message} hint={`Shop address: /p/${slug}${current ? ". Renaming doesn’t change it." : ""}`}>
                {(p) => <Input {...p} autoComplete="off" {...register("name")} />}
              </Field>
              <Field label="Tagline" optional error={errors.tagline?.message} hint="One line under the name, like “A cuddly bear in a stripy sweater”.">
                {(p) => <Input {...p} autoComplete="off" {...register("tagline")} />}
              </Field>
              <Field label="Description" error={errors.description?.message} hint="What it is, how it feels, what makes it special. Plain words.">
                {(p) => <Textarea {...p} rows={5} {...register("description")} />}
              </Field>
              <Field label="Category" error={errors.category?.message} className="md:max-w-sm">
                {(p) => (
                  <Select {...p} {...register("category")}>
                    <option value="">Choose a category</option>
                    {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                  </Select>
                )}
              </Field>
            </div>
          </Panel>

          <Panel title="Photos">
            <Controller control={control} name="images" render={({ field }) => <ImagesField value={field.value} onChange={(v) => field.onChange(v)} error={rootMessage(errors.images)} />} />
          </Panel>

          <Panel title="Price and making">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Price (₹)" error={errors.price?.message} hint={Number.isFinite(priceNum) && priceNum > 0 ? `Shoppers see ${formatINR(priceNum)}.` : undefined}>
                  {(p) => (
                    <div className="flex gap-2">
                      <Input {...p} inputMode="numeric" placeholder="1299" className="tabular" {...register("price")} />
                      <Button type="button" variant="secondary" onClick={() => setCalcOpen(true)} className="shrink-0 px-3" aria-label="Open the price calculator">
                        <Calculator aria-hidden strokeWidth={1.8} />
                      </Button>
                    </div>
                  )}
                </Field>
                <Field label="Compare-at price (₹)" optional error={errors.compareAtPrice?.message} hint="A higher, crossed-out price. Leave empty if there's no offer.">
                  {(p) => <Input {...p} inputMode="numeric" className="tabular" {...register("compareAtPrice")} />}
                </Field>
              </div>
              <fieldset>
                <legend className="mb-1.5 text-sm font-semibold">How it&apos;s made</legend>
                <div className="grid gap-2 md:grid-cols-2">
                  <Radio value="READY" label="Ready to ship" description="Already made. Sells from stock. Cash on delivery is allowed." {...register("fulfilment")} />
                  <Radio value="MADE_TO_ORDER" label="Made to order" description="Crocheted after the order. Shoppers see the lead time up front." {...register("fulfilment")} />
                </div>
              </fieldset>
              <Field
                label={fulfilment === "READY" ? "Days to dispatch" : "Days to make"}
                error={errors.leadTimeDays?.message}
                hint={fulfilment === "READY" ? "Time to pack and hand to the courier. Shown at checkout as the dispatch date." : "Time to crochet it before dispatch. Shown on the product page and at checkout."}
                className="md:max-w-xs"
              >
                {(p) => <Input {...p} inputMode="numeric" className="tabular" {...register("leadTimeDays")} />}
              </Field>
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">Options</legend>
                <Checkbox label="One of a kind. Only one exists and it sells out once bought." {...register("isOneOfAKind")} />
                <Checkbox label="Customizable. Shows “Customize this” so shoppers can request changes." {...register("customizable")} />
                <Checkbox label="Giftable. Suitable to send as a gift." {...register("giftable")} />
              </fieldset>
            </div>
          </Panel>

          <Panel title="Variants and stock">
            <VariantsField control={control} register={register} errors={errors} ooak={ooak} fulfilment={fulfilment} />
          </Panel>

          <Panel title="Colour swatches">
            <SwatchesField control={control} register={register} errors={errors} variantColours={variantColours} />
          </Panel>

          <Panel title="Details">
            <div className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Fiber" optional hint="Yarn and weight.">
                  {(p) => <Input {...p} placeholder="Milk cotton, 4-ply" {...register("fiber")} />}
                </Field>
                <Field label="Size" optional hint="In centimetres.">
                  {(p) => <Input {...p} placeholder="28 cm tall" {...register("sizeCm")} />}
                </Field>
                <Field label="Weight (g)" optional error={errors.weightG?.message}>
                  {(p) => <Input {...p} inputMode="numeric" className="tabular" {...register("weightG")} />}
                </Field>
              </div>
              <Field label="Care instructions" optional hint="One instruction per line.">
                {(p) => <Textarea {...p} rows={4} {...register("care")} />}
              </Field>
              <fieldset>
                <legend className="mb-1 text-sm font-semibold">Occasions</legend>
                <div className="grid gap-x-4 sm:grid-cols-2 md:grid-cols-3">
                  {occasionOptions.map((o) => <Checkbox key={o} label={o} value={o} {...register("occasions")} />)}
                </div>
              </fieldset>
              <Field label="Tags" optional hint="Separate with commas: amigurumi, cotton, gift.">
                {(p) => <Input {...p} autoComplete="off" {...register("tags")} />}
              </Field>
            </div>
          </Panel>
        </div>
      </AdminPage>

      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center justify-between gap-2 rounded-ticket bg-paper px-4 py-2.5 shadow-lift lg:bottom-4">
        <p aria-live="polite" className="text-sm font-semibold text-brown">{isDirty ? "Unsaved changes" : current ? "All changes saved" : "Not saved yet"}</p>
        <div className="flex gap-2">
          {isDirty && current ? <Button type="button" variant="ghost" onClick={() => reset(defaults)}>Discard</Button> : null}
          <Button type="submit" disabled={isSubmitting || (!!current && !isDirty)}>{isSubmitting ? "Saving…" : current ? "Save changes" : "Save product"}</Button>
        </div>
      </div>
    </form>
    <Drawer open={calcOpen} onOpenChange={setCalcOpen} title="Price calculator" description="Work out what this piece costs, then use the price it suggests.">
      <PriceCalculator
        onApply={(p) => {
          setValue("price", String(p), { shouldDirty: true, shouldValidate: true });
          setCalcOpen(false);
          toast.success(`Price set to ${formatINR(p)}.`);
        }}
      />
    </Drawer>
    </>
  );
}

/* ───────── loader ───────── */

function EditorSkeleton() {
  return (
    <div role="status" aria-label="Loading the product" className="space-y-4">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-40" />
      <Skeleton className="h-72" />
      <Skeleton className="h-56" />
    </div>
  );
}

export function ProductEditorLoader({ id }: { id?: string }) {
  const cats = useApi(listCategories, "editor-categories");
  const prod = useApi(() => getAdminProduct(id!), `editor-product:${id}`, !!id);

  if (id && prod.error) {
    const notFound = (prod.error as { status?: number }).status === 404;
    return notFound ? (
      <EmptyState title="Product not found" action={<Button asChild><Link href="/admin/products">Back to products</Link></Button>}>
        It may have been removed. Head back to the list and pick another.
      </EmptyState>
    ) : (
      <ErrorNote onRetry={prod.reload}>{prod.error.message || "The product didn't load."}</ErrorNote>
    );
  }
  if (cats.error) return <ErrorNote onRetry={cats.reload}>{cats.error.message || "Categories didn't load."}</ErrorNote>;
  if (!cats.data || (id && !prod.data)) return <EditorSkeleton />;
  return <ProductForm key={id ?? "new"} product={prod.data} categories={cats.data} />;
}
