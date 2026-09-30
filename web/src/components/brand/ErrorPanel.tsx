"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { YarnBall } from "@/components/brand/YarnBall";
import { cn } from "@/lib/cn";

interface Props {
  /** Try the failed render again. */
  reset: () => void;
  /** Server-side error id, shown so the maker can find the log line. */
  digest?: string;
  /** Fills the screen (root and global boundaries) instead of sitting inside the store layout. */
  fullPage?: boolean;
}

/** The "something broke" screen. Same voice as the 404: plain words, one way forward. */
export function ErrorPanel({ reset, digest, fullPage }: Props) {
  return (
    <div
      role="alert"
      className={cn("grid place-items-center px-6 py-16 text-center", fullPage ? "min-h-dvh" : "min-h-[60dvh]")}
    >
      <div className="flex max-w-md flex-col items-center gap-5">
        <YarnBall className="w-32" spin={false} tone="kraft" />
        <h1 className="font-display text-[clamp(2.5rem,9vw,4.5rem)]">Snagged a thread</h1>
        <p className="text-brown">
          Something went wrong on our side. Try again, and if it keeps happening, message us on WhatsApp and we&apos;ll sort it out.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" onClick={reset}>
            Try again
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/">Back to the factory</Link>
          </Button>
        </div>
        {digest ? <p className="font-stencil text-sm tracking-wide text-brown/70">Ref {digest}</p> : null}
      </div>
    </div>
  );
}
