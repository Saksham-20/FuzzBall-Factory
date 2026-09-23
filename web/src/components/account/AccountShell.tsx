"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Heart, LayoutDashboard, LogOut, MapPin, PackageOpen, Scissors, UserRound } from "lucide-react";
import { HookSpinner } from "@/components/ui/misc";
import { RequireAuth } from "@/components/ui/RequireAuth";
import { useAuth } from "@/lib/state/AuthContext";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/account", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/account/orders", label: "Orders", icon: PackageOpen },
  { href: "/account/custom", label: "Work orders", icon: Scissors },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/profile", label: "Profile", icon: UserRound },
] as const;


function useLogout() {
  const { logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      await logout();
      router.replace("/");
    } catch {
      toast.error("We couldn't log you out. Please try again.");
      setBusy(false);
    }
  }
  return { busy, run };
}

/** Side nav on desktop, horizontal tabs on phones. Wraps every account page in the login guard. */
export function AccountShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { user } = useAuth();
  const out = useLogout();
  const isActive = (l: (typeof LINKS)[number]) => ("exact" in l && l.exact ? path === l.href : path === l.href || path.startsWith(`${l.href}/`));

  // While logging out, drop the guard so it can't redirect to /login?next=/account before we head home.
  if (out.busy) {
    return (
      <div className="grid min-h-[50dvh] place-items-center">
        <HookSpinner label="Logging you out" />
      </div>
    );
  }

  return (
    <RequireAuth>
      <div className="shell py-8 md:py-12 lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] lg:gap-14">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="flex items-center justify-between gap-3 lg:block">
            <div className="min-w-0">
              <p className="font-stencil text-[11px] text-brown-soft">Signed in as</p>
              <p className="truncate font-semibold">{user?.name}</p>
            </div>
            <button
              type="button"
              onClick={out.run}
              className={cn("press inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-brown lg:hidden", `hf:hover:bg-cocoa/8`)}
            >
              <LogOut className="size-[1.1em]" strokeWidth={1.8} aria-hidden />
              Log out
            </button>
          </div>

          <nav aria-label="Account" className="mt-4 lg:mt-6">
            <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 md:-mx-8 md:px-8 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
              {LINKS.map((l) => {
                const on = isActive(l);
                return (
                  <li key={l.href} className="shrink-0">
                    <Link
                      href={l.href}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "press flex min-h-11 items-center gap-2.5 rounded-full px-4 text-[15px] font-semibold whitespace-nowrap transition-colors duration-150",
                        on ? "bg-cocoa text-cream" : `text-brown hf:hover:bg-cocoa/8`,
                      )}
                    >
                      <l.icon className="size-[18px] shrink-0" strokeWidth={1.8} aria-hidden />
                      {l.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <button
            type="button"
            onClick={out.run}
            className={cn("press mt-4 hidden min-h-11 items-center gap-2.5 rounded-full px-4 text-[15px] font-semibold text-brown lg:flex", `hf:hover:bg-cocoa/8`)}
          >
            <LogOut className="size-[18px]" strokeWidth={1.8} aria-hidden />
            Log out
          </button>
        </div>

        <div className="mt-8 min-w-0 lg:mt-0">{children}</div>
      </div>
    </RequireAuth>
  );
}

/** Page title inside the account area. One h1 per page. */
export function AccountHeading({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <h1 className="font-display text-[clamp(2.5rem,6vw,3.75rem)]">{title}</h1>
      {children}
    </div>
  );
}
