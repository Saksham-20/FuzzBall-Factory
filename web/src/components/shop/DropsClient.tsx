"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { SkeletonGrid } from "@/components/shop/ShopClient";
import { ProductTicket } from "@/components/store/ProductTicket";
import { Button } from "@/components/ui/Button";
import { EmptyState, ErrorNote } from "@/components/ui/misc";
import { listProducts } from "@/lib/api/catalog";
import { useApi } from "@/lib/api/useApi";
import { waLink } from "@/lib/whatsapp";

export function DropsClient() {
  const { data, error, loading, reload } = useApi(() => listProducts({ sort: "newest", pageSize: 12 }), "drops");
  const items = data?.items ?? [];

  return (
    <>
      <div className="shell pt-8 md:pt-12">
        <h1 className="font-display text-[clamp(3rem,9vw,6rem)]">Fresh off the line</h1>
        <p className="mt-3 max-w-[52ch] text-brown">The newest pieces to come off the hook, newest first.</p>
      </div>

      <div className="shell mt-6">
        <div className="flex flex-col gap-4 rounded-ticket bg-kraft-light p-5 md:flex-row md:items-center md:justify-between md:gap-8 md:p-6">
          <p className="max-w-[62ch]">
            <span className="font-bold">How drops work here.</span> Small batches and one-of-one pieces land on this page first. There is no countdown and no queue: if a piece is here, you can buy it. Once a one-of-one is gone, it is gone.
          </p>
          <Button asChild variant="secondary" className="shrink-0 self-start md:self-auto">
            <a href={waLink("Hi! Please message me when the next FuzzBall drop lands.")} target="_blank" rel="noopener noreferrer">
              <MessageCircle aria-hidden strokeWidth={1.8} />
              Ask to hear about the next one
            </a>
          </Button>
        </div>
      </div>

      <section aria-label="Newest pieces" className="shell pt-8 pb-24">
        {error ? (
          <ErrorNote onRetry={reload}>{error.message || "The shelf didn't load."} Check your connection and try again.</ErrorNote>
        ) : loading && !data ? (
          <SkeletonGrid count={8} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing new right now"
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button asChild>
                  <Link href="/shop">See the whole shelf</Link>
                </Button>
                <Button asChild variant="secondary">
                  <Link href="/custom">Put in a work order</Link>
                </Button>
              </div>
            }
          >
            The next batch is still on the hook. Browse the shelf, or ask for something made just for you.
          </EmptyState>
        ) : (
          <>
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {items.map((p, i) => (
                <li key={p.id}>
                  <ProductTicket product={p} priority={i < 4} sizes="(min-width:1280px) 22vw, (min-width:768px) 30vw, 46vw" />
                </li>
              ))}
            </ul>
            <div className="mt-10 flex justify-center">
              <Button asChild variant="secondary" size="lg">
                <Link href="/shop">See the whole shelf</Link>
              </Button>
            </div>
          </>
        )}
      </section>
    </>
  );
}
