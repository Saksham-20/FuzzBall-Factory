"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
import { RequireAuth } from "@/components/ui/RequireAuth";
import { ErrorNote, Skeleton } from "@/components/ui/misc";
import { BigStamp } from "@/components/checkout/PlacedStamp";
import { getMine } from "@/lib/api/custom";
import { getSettings } from "@/lib/api/settings";
import { useApi } from "@/lib/api/useApi";
import { SAMPLE_SETTINGS } from "@/lib/site";
import { formatDate, formatINR } from "@/lib/format";
import { waCustom } from "@/lib/whatsapp";

export function SentClient({ wo }: { wo: string }) {
  return (
    <RequireAuth>
      <Sent wo={wo} />
    </RequireAuth>
  );
}

function Sent({ wo }: { wo: string }) {
  const { data: r, error, loading, reload } = useApi(() => getMine(wo), `wo:${wo}`);
  const { data: settings } = useApi(getSettings, "settings");
  const deposit = settings?.depositPct ?? SAMPLE_SETTINGS.depositPct;
  const validity = settings?.quoteValidityDays ?? 7;

  if (loading && !r) {
    return (
      <div className="shell py-10 md:py-16" aria-busy="true">
        <Skeleton className="mx-auto h-72 max-w-[720px] rounded-ticket" />
      </div>
    );
  }
  if (error || !r) {
    return (
      <div className="shell py-10 md:py-16">
        <div className="mx-auto max-w-[720px] space-y-4">
          <ErrorNote onRetry={reload}>{error?.message ?? "We couldn't load that work order."}</ErrorNote>
          <Button asChild variant="secondary">
            <Link href="/custom">Start a work order</Link>
          </Button>
        </div>
      </div>
    );
  }

  const next = [
    { t: "We read it", d: "The maker looks at your idea, your photos and your budget. If something's unclear, we'll ask you in your account." },
    { t: "You get a quote", d: `A price, a timeline and exactly what's included. It stays open for ${validity} days. Accept, counter or pass.` },
    { t: `You pay ${deposit}% to start`, d: "The advance is what puts your piece in the queue. The rest is due before it ships." },
  ];

  return (
    <div className="shell py-10 md:py-16">
      <div className="mx-auto max-w-[720px]">
        <Ticket head={[`Work order · ${r.number}`, formatDate(r.createdAt)]} className="p-2.5 md:p-3.5">
          <div className="rounded-[10px] bg-paper p-6 md:p-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="min-w-0">
                <h1 className="font-display text-[clamp(2.5rem,7vw,4.5rem)]">Work order received</h1>
                <p className="font-stencil tabular mt-3 text-[15px]">{r.number}</p>
              </div>
              <BigStamp label="Received" tone="ok" animate rotate={-6} />
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 border-y border-line py-4 text-[15px] sm:grid-cols-3">
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <p className="font-stencil text-[11px] text-brown-soft">Request</p>
                <p className="mt-0.5 font-semibold">{r.title}</p>
              </div>
              <div>
                <p className="font-stencil text-[11px] text-brown-soft">Quantity</p>
                <p className="tabular mt-0.5 font-semibold">{r.quantity}</p>
              </div>
              <div>
                <p className="font-stencil text-[11px] text-brown-soft">Your budget</p>
                <p className="tabular mt-0.5 font-semibold">
                  {formatINR(r.budgetMin)} to {formatINR(r.budgetMax)}
                </p>
              </div>
            </div>

            <h2 className="mt-8 font-display text-[1.75rem] sm:text-[2rem]">What happens next</h2>
            <ol className="mt-3 divide-y divide-line">
              {next.map((s, i) => (
                <li key={s.t} className="grid grid-cols-[2.25rem_1fr] gap-x-3 py-3.5">
                  <span className="font-stencil tabular grid size-8 place-items-center rounded-full bg-cocoa text-[13px] text-cream">{i + 1}</span>
                  <div>
                    <h3 className="font-bold">{s.t}</h3>
                    <p className="mt-0.5 text-[15px] leading-relaxed text-brown">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 max-w-[60ch] text-sm text-brown">
              Every piece is made by one person, so we can&apos;t promise the day you&apos;ll hear back. If your date is tight, message us on WhatsApp and mention {r.number}.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href={`/account/custom/${r.number}`}>View in your account</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <a href={waCustom(r.number)} target="_blank" rel="noopener noreferrer">
                  <MessageCircle /> Chat on WhatsApp
                </a>
              </Button>
            </div>
            <Button asChild variant="ghost" className="mt-3">
              <Link href="/shop">Back to the shelf</Link>
            </Button>
          </div>
        </Ticket>
      </div>
    </div>
  );
}
