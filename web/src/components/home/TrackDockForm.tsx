"use client";

import { useRouter } from "next/navigation";
import { useRef, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TRACK_HANDOFF_KEY } from "@/lib/track-handoff";

const field =
  "h-12 w-full rounded-[12px] border-[1.5px] border-line-strong bg-cream px-4 text-base text-cocoa placeholder:text-brown-soft/80 focus-visible:border-rose-deep";

/**
 * The landing page's tracking form. The phone number is handed to /track through sessionStorage, never the URL (URLs
 * end up in history, server logs and referrers). The phone input has no `name`, so even without JavaScript only the
 * order number can travel in the query string.
 */
export function TrackDockForm() {
  const router = useRouter();
  const phone = useRef<HTMLInputElement>(null);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const order = String(form.get("order") ?? "").trim();
    const contact = (phone.current?.value ?? "").trim();
    try {
      sessionStorage.setItem(TRACK_HANDOFF_KEY, JSON.stringify({ order, contact }));
    } catch {
      // Storage blocked: /track will simply ask again.
    }
    router.push("/track");
  }

  return (
    <form action="/track" method="get" onSubmit={onSubmit} className="mt-5 space-y-3 border-t-2 border-dashed border-line-strong pt-5">
      <div>
        <label htmlFor="track-order" className="mb-1.5 block text-sm font-semibold">
          Order number
        </label>
        <input id="track-order" name="order" placeholder="FB-1023" autoComplete="off" required className={field} />
      </div>
      <div>
        <label htmlFor="track-phone" className="mb-1.5 block text-sm font-semibold">
          Phone number
        </label>
        <input ref={phone} id="track-phone" type="tel" inputMode="tel" placeholder="With country code" autoComplete="tel" required className={field} />
      </div>
      <Button type="submit" size="lg" className="w-full sm:w-auto">
        Track my order
      </Button>
    </form>
  );
}
