"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { YarnBall } from "@/components/brand/YarnBall";
import { BuyBox } from "@/components/shop/BuyBox";
import { Gallery } from "@/components/shop/Gallery";
import { ProductDetails } from "@/components/shop/ProductDetails";
import { Reviews } from "@/components/shop/Reviews";
import { ProductTicket } from "@/components/store/ProductTicket";
import { Button } from "@/components/ui/Button";
import { ErrorNote, Skeleton } from "@/components/ui/misc";
import { getProduct, listCategories, relatedProducts } from "@/lib/api/catalog";
import { useApi } from "@/lib/api/useApi";
import { ApiError } from "@/lib/mock/db";
import type { Product } from "@/lib/types";

function ProductSkeleton() {
  return (
    <div aria-busy="true" className="shell pt-6 pb-24 lg:grid lg:grid-cols-12 lg:gap-x-12">
      <span className="sr-only" role="status">
        Loading this piece…
      </span>
      <div className="lg:col-span-7">
        <Skeleton className="aspect-[4/5] w-full rounded-ticket" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="size-16" />
          <Skeleton className="size-16" />
          <Skeleton className="size-16" />
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-5 lg:col-span-5 lg:mt-0">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-4/5" />
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-14 w-full rounded-full" />
      </div>
    </div>
  );
}

function MissingBatch() {
  return (
    <div className="shell grid place-items-center py-24 text-center">
      <div className="flex max-w-md flex-col items-center gap-4">
        <YarnBall className="w-32" spin={false} tone="kraft" />
        <h1 className="font-display text-[clamp(2.5rem,8vw,4rem)]">This batch doesn&apos;t exist</h1>
        <p className="text-brown">
          The link may be old, or this piece has left the shelf for good. The rest of the shelf is still there.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/shop">See the whole shelf</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/custom">Put in a work order</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function MadeToBeCustomized({ product: p }: { product: Product }) {
  const soldOut = p.variants.every((v) => v.stock === 0);
  return (
    <section aria-labelledby="custom-h" className="bg-kraft">
      <div className="shell flex flex-col gap-6 py-[clamp(3.5rem,8vw,6rem)] md:flex-row md:items-center md:justify-between md:gap-12">
        <div className="max-w-[60ch]">
          <h2 id="custom-h" className="font-display text-[clamp(2.5rem,6vw,4.5rem)]">
            {soldOut ? "Want one like it?" : "Made to be customized"}
          </h2>
          <p className="mt-4 text-[1.0625rem]">
            {soldOut
              ? `${p.name} is gone, but the maker can crochet you a similar one. Tell us the colours and size you have in mind.`
              : `Another colour, a different size, a name stitched in? Tell us what you would change about ${p.name} and we will send a quote before you pay anything.`}
          </p>
        </div>
        <Button asChild size="lg" className="shrink-0 self-start md:self-auto">
          <Link href={`/custom?from=${p.slug}`}>{soldOut ? "Request a similar one" : "Customize this piece"}</Link>
        </Button>
      </div>
    </section>
  );
}

function MoreFromShelf({ slug }: { slug: string }) {
  const rel = useApi(() => relatedProducts(slug, 4), `related:${slug}`);
  return (
    <section aria-labelledby="more-h" className="shell py-[clamp(3.5rem,8vw,6rem)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="more-h" className="font-display text-[clamp(2.25rem,5vw,3.5rem)]">
          More from the shelf
        </h2>
        <Link href="/shop" className="inline-flex min-h-11 items-center font-semibold text-cocoa underline">
          See the whole shelf
        </Link>
      </div>
      <div className="mt-6">
        {rel.error ? (
          <ErrorNote onRetry={rel.reload}>We couldn&apos;t load more pieces.</ErrorNote>
        ) : !rel.data ? (
          <ul aria-hidden className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className="rounded-ticket bg-kraft-light/60 p-2.5">
                <Skeleton className="mt-5 aspect-[4/5]" />
                <Skeleton className="mt-3 h-5 w-3/4" />
                <Skeleton className="mt-2 mb-1.5 h-4 w-1/3" />
              </li>
            ))}
          </ul>
        ) : rel.data.length === 0 ? (
          <p className="text-brown">Nothing else is on the shelf right now.</p>
        ) : (
          <ul className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0 md:pb-0">
            {rel.data.map((r) => (
              <li key={r.id} className="w-[62vw] max-w-[280px] shrink-0 snap-start md:w-auto md:max-w-none">
                <ProductTicket product={r} sizes="(min-width:1280px) 22vw, (min-width:768px) 24vw, 62vw" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Loaded({ product: p }: { product: Product }) {
  const cats = useApi(listCategories, "categories");
  const cat = cats.data?.find((c) => c.slug === p.category);
  const soldOut = p.variants.every((v) => v.stock === 0);

  return (
    <>
      <nav aria-label="Breadcrumb" className="shell pt-4 pb-2">
        <ol className="flex flex-wrap items-center gap-x-1 text-sm text-brown">
          <li>
            <Link href="/shop" className="inline-flex min-h-11 items-center underline">
              Shop
            </Link>
          </li>
          {cat ? (
            <li className="flex items-center gap-1">
              <ChevronRight aria-hidden className="size-4" />
              <Link href={`/shop/${cat.slug}`} className="inline-flex min-h-11 items-center underline">
                {cat.name}
              </Link>
            </li>
          ) : null}
          <li className="flex items-center gap-1" aria-current="page">
            <ChevronRight aria-hidden className="size-4" />
            <span className="font-semibold text-cocoa">{p.name}</span>
          </li>
        </ol>
      </nav>

      <div className="shell pt-2 pb-[clamp(3rem,6vw,5rem)] lg:grid lg:grid-cols-12 lg:gap-x-12">
        <Gallery images={p.images} name={p.name} soldOut={soldOut} className="lg:col-span-7 lg:row-start-1" />
        <div className="mt-8 lg:col-span-5 lg:col-start-8 lg:row-span-2 lg:row-start-1 lg:mt-0 [@media(min-width:1024px)_and_(min-height:820px)]:sticky [@media(min-width:1024px)_and_(min-height:820px)]:top-[92px] lg:self-start">
          <BuyBox key={p.id} product={p} />
        </div>
        <ProductDetails product={p} className="mt-8 lg:col-span-7 lg:col-start-1 lg:row-start-2" />
      </div>

      <MadeToBeCustomized product={p} />
      <Reviews product={p} />
      <MoreFromShelf slug={p.slug} />
    </>
  );
}

/** Product page body. Loads through the API layer so it works the same on mock and real data. */
export function ProductView({ slug }: { slug: string }) {
  const { data, error, reload } = useApi(() => getProduct(slug), `product:${slug}`);

  if (error) {
    if (error instanceof ApiError && error.status === 404) return <MissingBatch />;
    return (
      <div className="shell py-16">
        <ErrorNote onRetry={reload}>{error.message || "This piece didn't load."} Check your connection and try again.</ErrorNote>
      </div>
    );
  }
  if (!data || data.slug !== slug) return <ProductSkeleton />;
  return <Loaded key={data.id} product={data} />;
}
