import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { figtree, modak, stencil } from "@/app/fonts";
import { Providers } from "@/app/providers";
import { SITE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} · Handmade crochet, made with love`, template: `%s · ${SITE.name}` },
  description:
    "Handmade crochet plushies, bouquets, bags and gifts. Ready to ship or made to order. Custom work orders welcome. Handmade with love in India.",
  openGraph: { siteName: SITE.name, type: "website", locale: "en_IN" },
};

export const viewport: Viewport = { themeColor: "#f6eee3" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN" className={`${modak.variable} ${figtree.variable} ${stencil.variable}`}>
      <body className="min-h-dvh antialiased">
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-center"
          mobileOffset={{ bottom: 84 }}
          toastOptions={{
            style: {
              background: "var(--color-cocoa)",
              color: "var(--color-cream)",
              borderRadius: "14px",
              border: "none",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </body>
    </html>
  );
}
