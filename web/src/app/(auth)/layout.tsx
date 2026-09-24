import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { Tape } from "@/components/brand/Tape";
import { YarnBall } from "@/components/brand/YarnBall";

const TAPE = ["Handmade with love", "Cozy crocheted goods", "Ready to ship", "Made to order", "Custom work orders"] as const;

/** Split screen: the form on paper, a kraft panel with a slow yarn ball on wide screens. No store header or footer. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <a
        href="#main"
        className="sr-only z-[70] rounded-full bg-cocoa px-5 py-3 font-semibold text-cream focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <div className="flex min-h-dvh flex-col bg-paper px-5 pt-5 pb-6 sm:px-10 lg:px-16">
        <header>
          <Link href="/" aria-label="FuzzBall Factory, back to the home page" className="inline-flex min-h-11 items-center rounded-md">
            <LogoMark />
          </Link>
        </header>
        <main id="main" className="flex flex-1 items-center py-10">
          <div className="mx-auto w-full max-w-[26rem]">{children}</div>
        </main>
        <footer>
          <Link href="/shop" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-brown underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline">
            <ArrowLeft className="size-4" strokeWidth={1.8} aria-hidden />
            Back to the shop
          </Link>
        </footer>
      </div>

      {/* Decoration only: hidden from screen readers piece by piece, not as a whole,
          because the tape's pause button inside it has to stay reachable. */}
      <div className="kraft relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="relative flex flex-1 items-center justify-center px-12 pt-16">
          <div className="relative w-[min(72%,26rem)]">
            <YarnBall className="w-full" />
            {/* the loose end of the thread, curling off the ball */}
            <svg viewBox="0 0 200 260" className="absolute top-[78%] left-[8%] h-[62%] w-[52%] overflow-visible" fill="none">
              <path d="M22 0 C22 60 -30 90 30 130 C92 170 150 150 160 200 C168 240 110 250 84 236" stroke="#c98586" strokeWidth="7" strokeLinecap="round" />
            </svg>
          </div>
        </div>
        <div aria-hidden className="relative px-12 pb-10">
          <p className="font-display text-[clamp(2.5rem,4vw,3.75rem)]">Cozy crocheted goods</p>
          <p className="mt-3 max-w-[38ch] text-brown">Every piece is made by hand, so every order and work order has a status you can follow.</p>
        </div>
        <Tape items={TAPE} className="pb-8" decorative />
      </div>
    </div>
  );
}
