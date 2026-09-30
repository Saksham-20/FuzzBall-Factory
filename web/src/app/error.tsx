"use client";

import { ErrorPanel } from "@/components/brand/ErrorPanel";

export default function RootError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main>
      <ErrorPanel reset={reset} error={error} fullPage />
    </main>
  );
}
