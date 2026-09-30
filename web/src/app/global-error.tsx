"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-error";
import "./globals.css";

/**
 * Last resort: the root layout itself failed, so no providers, fonts or components are safe to use. Plain elements
 * and the palette from globals.css only; a full reload is the only retry that can help here.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error, "global"), [error]);
  return (
    <html lang="en-IN">
      <body className="min-h-dvh antialiased">
        <main role="alert" className="grid min-h-dvh place-items-center px-6 py-16 text-center">
          <div className="flex max-w-md flex-col items-center gap-5">
            <h1 className="font-display text-[clamp(2.5rem,9vw,4.5rem)]">Snagged a thread</h1>
            <p className="text-brown">
              The site hit a problem and could not load. Reload the page, and if it keeps happening, message us on WhatsApp.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="press inline-flex h-[52px] items-center justify-center rounded-full bg-cocoa px-8 text-base font-semibold text-cream"
            >
              Reload
            </button>
            {error.digest ? <p className="text-sm text-brown/70">Ref {error.digest}</p> : null}
          </div>
        </main>
      </body>
    </html>
  );
}
