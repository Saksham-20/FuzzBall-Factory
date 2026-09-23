"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Ticket } from "@/components/brand/Ticket";
import { CustomForm } from "@/components/custom/CustomForm";
import { loadDraft } from "@/components/custom/draft";
import { ErrorNote, PageHeader, Skeleton } from "@/components/ui/misc";
import { getProduct, listCategories } from "@/lib/api/catalog";
import { useApi } from "@/lib/api/useApi";
import { batchLabel, formatINR } from "@/lib/format";
import type { Product } from "@/lib/types";

const noop = () => () => {};

/** Waits for the browser (the draft lives in localStorage) before mounting the form, so it never hydrates with the wrong values. */
export function CustomClient({ from, resume }: { from?: string; resume: boolean }) {
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  return (
    <div className="shell py-8 md:py-12">
      <PageHeader title={from ? "Customize a piece" : "Put in a work order"} />
      <p className="mt-3 max-w-[60ch] text-brown">
        {from
          ? "Tell us what to change: colours, size, a name, the details. We'll send back a quote you can accept, counter or pass on."
          : "Describe what you'd like made. We'll send back a quote with a price and a timeline. Nothing is charged until you accept it."}
      </p>
      <div className="mx-auto mt-8 max-w-[820px]">{mounted ? <Loaded from={from} resume={resume} /> : <Skeleton className="h-[520px] rounded-ticket" />}</div>
    </div>
  );
}

function Loaded({ from, resume }: { from?: string; resume: boolean }) {
  const [draft] = useState(() => loadDraft());
  // A draft for a different base product is set aside; one for the same product (or none) is kept.
  const usable = draft && (!from || draft.from === from) ? draft : null;
  const activeFrom = from ?? usable?.from;

  const cats = useApi(listCategories, "categories");
  const base = useApi(() => getProduct(activeFrom!), `product:${activeFrom}`, !!activeFrom);

  if (cats.error) {
    return <ErrorNote onRetry={cats.reload}>We couldn&apos;t load the form. Check your connection and try again.</ErrorNote>;
  }
  if (!cats.data || (activeFrom && base.loading)) return <Skeleton className="h-[520px] rounded-ticket" />;

  const product = base.error ? undefined : base.data;
  return (
    <div className="space-y-6">
      {activeFrom && base.error ? <ErrorNote>We couldn&apos;t find that piece, so this is a new work order instead.</ErrorNote> : null}
      {product ? <BaseProduct product={product} /> : null}
      <CustomForm key={activeFrom ?? "new"} initial={usable} product={product} from={product ? activeFrom : undefined} categories={cats.data} resume={resume} />
    </div>
  );
}

function BaseProduct({ product: p }: { product: Product }) {
  return (
    <Ticket head={[batchLabel(p.batch), "Customizing"]} className="p-2.5">
      <div className="flex items-center gap-4 rounded-[10px] bg-paper p-3">
        <div className="relative size-20 shrink-0 overflow-hidden rounded-[10px] bg-kraft-light">
          <Image src={p.images[0].src} alt={p.images[0].alt} fill sizes="80px" className="object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-brown">Customizing</p>
          <p className="font-display text-[1.75rem] leading-none">{p.name}</p>
          <p className="tabular mt-1.5 text-sm text-brown">
            From {formatINR(p.price)}. Your price comes from the quote.{" "}
            <Link href={`/p/${p.slug}`} className="font-semibold text-cocoa underline">
              See the piece
            </Link>
          </p>
        </div>
      </div>
    </Ticket>
  );
}
