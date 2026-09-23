"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { BarChart3, Boxes, Calculator, ClipboardList, Package, PackageOpen, Star, Settings, Store, Tag, Users, FolderTree, LogOut, MoreHorizontal } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { Drawer } from "@/components/ui/Dialog";
import { RequireAuth } from "@/components/ui/RequireAuth";
import { useAuth } from "@/lib/state/AuthContext";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: BarChart3, exact: true, primary: true },
  { href: "/admin/orders", label: "Orders", icon: Package, primary: true },
  { href: "/admin/custom", label: "Work orders", icon: ClipboardList, primary: true },
  { href: "/admin/products", label: "Products", icon: PackageOpen, primary: true },
  { href: "/admin/pricing", label: "Price calculator", icon: Calculator },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/materials", label: "Materials", icon: Boxes },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/reviews", label: "Reviews", icon: Star },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/settings", label: "Settings", icon: Settings },
] as const;

function useActive() {
  const path = usePathname();
  return (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(href + "/"));
}

export function AdminShell({ children }: { children: ReactNode }) {
  const active = useActive();
  const { user, logout } = useAuth();
  const router = useRouter();
  const [more, setMore] = useState(false);

  const link = (n: (typeof NAV)[number], compact = false) => {
    const on = active(n.href, "exact" in n ? n.exact : false);
    return (
      <Link
        key={n.href}
        href={n.href}
        onClick={() => setMore(false)}
        aria-current={on ? "page" : undefined}
        className={cn(
          "press flex items-center gap-3 rounded-[12px] font-semibold transition-colors duration-150",
          compact ? "min-h-11 flex-col justify-center gap-0.5 px-1 py-1.5 text-[11px]" : "min-h-11 px-3 text-[15px]",
          on ? "bg-cocoa text-cream" : "text-brown [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/8",
        )}
      >
        <n.icon className={compact ? "size-5" : "size-[18px]"} strokeWidth={1.8} />
        {n.label}
      </Link>
    );
  };

  return (
    <RequireAuth role="admin">
      <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[248px_1fr]">
        <aside className="sticky top-0 hidden h-dvh flex-col gap-1 border-r border-line bg-paper p-4 lg:flex">
          <Link href="/admin" className="mb-4 rounded-md p-1">
            <LogoMark />
          </Link>
          <nav aria-label="Admin" className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {NAV.map((n) => link(n))}
          </nav>
          <Link href="/" className="press flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-[15px] font-semibold text-brown hover:bg-cocoa/8">
            <Store className="size-[18px]" strokeWidth={1.8} /> View store
          </Link>
          <button
            type="button"
            onClick={async () => { await logout(); router.replace("/login"); }}
            className="press flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-left text-[15px] font-semibold text-brown hover:bg-cocoa/8"
          >
            <LogOut className="size-[18px]" strokeWidth={1.8} /> Log out
            <span className="ml-auto max-w-[8ch] truncate text-xs font-normal text-brown-soft">{user?.name.split(" ")[0]}</span>
          </button>
        </aside>

        <div className="min-w-0 pb-24 lg:pb-0">
          <header className="flex h-14 items-center justify-between border-b border-line bg-cream px-4 lg:hidden">
            <Link href="/admin"><LogoMark /></Link>
            <Link href="/" className="text-sm font-semibold underline">View store</Link>
          </header>
          <main id="main" className="mx-auto w-full max-w-[1200px] px-4 py-6 md:px-8 md:py-10">{children}</main>
        </div>

        <nav aria-label="Admin quick links" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-1 border-t border-line bg-paper px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden">
          {NAV.filter((n) => "primary" in n).map((n) => link(n, true))}
          <button type="button" onClick={() => setMore(true)} className="press flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-[12px] px-1 py-1.5 text-[11px] font-semibold text-brown">
            <MoreHorizontal className="size-5" strokeWidth={1.8} />
            More
          </button>
        </nav>
        <Drawer open={more} onOpenChange={setMore} title="More">
          <div className="flex flex-col gap-1 pb-4">
            {NAV.filter((n) => !("primary" in n)).map((n) => link(n))}
            <button type="button" onClick={async () => { await logout(); router.replace("/login"); }} className="press mt-2 flex min-h-11 items-center gap-3 rounded-[12px] px-3 text-left text-[15px] font-semibold text-brown">
              <LogOut className="size-[18px]" strokeWidth={1.8} /> Log out
            </button>
          </div>
        </Drawer>
      </div>
    </RequireAuth>
  );
}
