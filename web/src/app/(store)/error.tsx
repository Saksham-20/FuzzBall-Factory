"use client";

import { ErrorPanel } from "@/components/brand/ErrorPanel";

/** Sits inside the store layout, so the header, footer and cart stay usable when one page breaks. */
export default function StoreError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel reset={reset} error={error} />;
}
