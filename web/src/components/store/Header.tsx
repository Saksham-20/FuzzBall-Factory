"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Heart, Menu as MenuIcon, ShoppingBag, User, X } from "lucide-react";
import { LogoMark } from "@/components/brand/LogoMark";
import { useAuth } from "@/lib/state/AuthContext";
import { useCart } from "@/lib/state/CartContext";
import { categories } from "@/lib/mock/catalog";
import { NAV } from "@/lib/site";
import { cn } from "@/lib/cn";

const scrolled = {
  subscribe(cb: () => void) {
    window.addEventListener("scroll", cb, { passive: true });
    return () => window.removeEventListener("scroll", cb);
  },
  get: () => window.scrollY > 8,
  server: () => false,
};

const iconBtn =
  "press relative grid size-11 place-items-center rounded-full text-cocoa transition-colors duration-150 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/8";

export function Header() {
  const isScrolled = useSyncExternalStore(scrolled.subscribe, scrolled.get, scrolled.server);
  const { count, setOpen, wishlist } = useCart();
  const { user } = useAuth();

  return (
    <header
      className={cn(
        "sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-200 ease-out",
        isScrolled ? "bg-cream/92 shadow-[0_1px_0_var(--color-line)] backdrop-blur-md" : "bg-cream",
      )}
    >
      <div className="shell flex h-[68px] items-center gap-4 md:h-[76px]">
        <Link href="/" aria-label="FuzzBall Factory, home" className="-ml-1 rounded-md p-1">
          <LogoMark />
        </Link>

        <nav aria-label="Main" className="ml-8 hidden items-center gap-1 lg:flex">
          <Menu.Root>
            <Menu.Trigger className="press inline-flex h-11 items-center gap-1 rounded-full px-4 text-[15px] font-semibold [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/8 data-[state=open]:bg-cocoa/8">
              Shop <ChevronDown className="size-4" />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content
                align="start"
                sideOffset={8}
                className="z-50 grid w-[440px] grid-cols-2 gap-1 rounded-ticket bg-paper p-2 shadow-lift origin-[var(--radix-dropdown-menu-content-transform-origin)] data-[state=open]:animate-[pop-in_180ms_var(--ease-out)]"
              >
                {categories.map((c) => (
                  <Menu.Item key={c.slug} asChild>
                    <Link
                      href={`/shop/${c.slug}`}
                      className="block rounded-[10px] px-3 py-2.5 outline-none data-[highlighted]:bg-kraft-light"
                    >
                      <span className="block font-semibold">{c.name}</span>
                      <span className="block text-sm text-brown">{c.blurb}</span>
                    </Link>
                  </Menu.Item>
                ))}
                <Menu.Item asChild>
                  <Link href="/shop" className="col-span-2 mt-1 rounded-[10px] bg-cocoa px-3 py-2.5 text-center font-semibold text-cream outline-none data-[highlighted]:bg-brown">
                    See the whole shelf
                  </Link>
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
          {NAV.filter((n) => n.href !== "/shop").map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="press inline-flex h-11 items-center rounded-full px-4 text-[15px] font-semibold [@media(hover:hover)_and_(pointer:fine)]:hover:bg-cocoa/8"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-0.5">
          <Link href="/account/wishlist" aria-label={`Wishlist, ${wishlist.length} saved`} className={cn(iconBtn, "hidden sm:grid")}>
            <Heart className="size-[21px]" strokeWidth={1.8} />
            {wishlist.length > 0 ? (
              <span className="tabular absolute top-1.5 right-1 size-2 rounded-full bg-rose-deep" aria-hidden />
            ) : null}
          </Link>
          <Link href={user ? "/account" : "/login"} aria-label={user ? "Your account" : "Log in"} className={cn(iconBtn, "hidden sm:grid")}>
            <User className="size-[21px]" strokeWidth={1.8} />
          </Link>
          <button type="button" onClick={() => setOpen(true)} aria-label={`Open basket, ${count} items`} className={iconBtn}>
            <ShoppingBag className="size-[21px]" strokeWidth={1.8} />
            {count > 0 ? (
              <span
                key={count}
                className="font-stencil tabular absolute top-0.5 right-0 grid min-w-[18px] animate-[bump_360ms_var(--ease-out)] place-items-center rounded-full bg-cocoa px-1 text-[11px] leading-[18px] text-cream"
              >
                {count}
              </span>
            ) : null}
          </button>

          <Dialog.Root>
            <Dialog.Trigger aria-label="Open menu" className={cn(iconBtn, "lg:hidden")}>
              <MenuIcon className="size-[22px]" strokeWidth={1.8} />
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-cocoa/45 data-[state=closed]:animate-[fade-out_200ms_ease-out_forwards] data-[state=open]:animate-[fade-in_250ms_ease-out]" />
              <Dialog.Content
                aria-describedby={undefined}
                className="fixed inset-y-0 left-0 z-50 flex w-[min(92vw,420px)] flex-col bg-cream p-5 shadow-lift outline-none data-[state=closed]:animate-[menu-out_240ms_var(--ease-drawer)_forwards] data-[state=open]:animate-[menu-in_380ms_var(--ease-drawer)]"
              >
                <div className="flex items-center justify-between">
                  <Dialog.Title className="sr-only">Menu</Dialog.Title>
                  <LogoMark />
                  <Dialog.Close aria-label="Close menu" className={iconBtn}>
                    <X className="size-5" />
                  </Dialog.Close>
                </div>
                <nav aria-label="Mobile" className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto" data-lenis-prevent>
                  {NAV.map((n) => (
                    <Dialog.Close key={n.href} asChild>
                      <Link href={n.href} className="font-display py-1.5 text-[2.6rem] text-cocoa">
                        {n.label}
                      </Link>
                    </Dialog.Close>
                  ))}
                  <p className="font-stencil mt-6 mb-1 text-[11px] text-brown-soft">Browse by</p>
                  <ul className="grid grid-cols-2 gap-x-4">
                    {categories.map((c) => (
                      <li key={c.slug}>
                        <Dialog.Close asChild>
                          <Link href={`/shop/${c.slug}`} className="block py-2.5 font-semibold text-brown">
                            {c.name}
                          </Link>
                        </Dialog.Close>
                      </li>
                    ))}
                  </ul>
                </nav>
                <div className="flex gap-2 pt-4">
                  <Dialog.Close asChild>
                    <Link href={user ? "/account" : "/login"} className="press flex h-11 flex-1 items-center justify-center rounded-full bg-cocoa font-semibold text-cream">
                      {user ? "My account" : "Log in"}
                    </Link>
                  </Dialog.Close>
                  <Dialog.Close asChild>
                    <Link href="/account/wishlist" className="press flex h-11 flex-1 items-center justify-center rounded-full bg-paper font-semibold shadow-ticket">
                      Wishlist
                    </Link>
                  </Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
