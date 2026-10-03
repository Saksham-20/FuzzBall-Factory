import type { ReactNode } from "react";
import { serverActiveCategories } from "@/lib/catalog-server";
import { Header } from "@/components/store/Header";
import { Footer } from "@/components/store/Footer";
import { CartDrawer } from "@/components/store/CartDrawer";
import { WhatsAppButton } from "@/components/store/WhatsAppButton";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const categories = await serverActiveCategories();
  return (
    <>
      <a
        href="#main"
        className="sr-only z-[70] rounded-full bg-cocoa px-5 py-3 font-semibold text-cream focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Header categories={categories} />
      <main id="main">{children}</main>
      <Footer />
      <CartDrawer />
      <WhatsAppButton />
    </>
  );
}
