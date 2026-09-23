import type { Metadata } from "next";
import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { ContactForm } from "@/components/content/ContactForm";
import { Ph } from "@/components/content/Placeholder";
import { LegalAddress } from "@/components/content/SellerDetails";
import { Button } from "@/components/ui/Button";
import { SITE } from "@/lib/site";
import { waGeneral } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact FuzzBall Factory: chat with the maker on WhatsApp, send an email or a message, and find our registered business address and grievance officer.",
  alternates: { canonical: "/contact" },
};

// PLACEHOLDER(legal-details): registered address. PLACEHOLDER(contact-hours): reply hours.
// PLACEHOLDER(whatsapp-number) and PLACEHOLDER(contact-email) live in lib/site.ts.
export default function ContactPage() {
  return (
    <div className="pt-[clamp(2.5rem,6vw,4.5rem)] pb-[clamp(4rem,9vw,7rem)]">
      <div className="shell">
        <h1 className="font-display text-[clamp(2.75rem,8vw,5rem)] text-balance">Say hello</h1>
        <p className="mt-5 max-w-[56ch] text-[1.1875rem] leading-relaxed text-brown">
          Questions about a piece, an order or a custom idea? Message the maker directly. WhatsApp is the quickest way.
        </p>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
          <div className="max-w-[68ch] space-y-10">
            <section aria-labelledby="wa-h" className="space-y-4">
              <h2 id="wa-h" className="font-display text-[clamp(1.875rem,4.2vw,2.5rem)]">
                Chat on WhatsApp
              </h2>
              <p className="text-[1.0625rem] leading-[1.7] text-brown">
                Ask about lead times, see a piece in natural light, or talk through a custom order. The chat opens with a message ready to send.
              </p>
              <Button asChild variant="tape" size="lg">
                <a href={waGeneral()} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden strokeWidth={1.8} />
                  Chat on WhatsApp
                </a>
              </Button>
            </section>

            <section aria-labelledby="email-h" className="space-y-3">
              <h2 id="email-h" className="font-display text-[clamp(1.875rem,4.2vw,2.5rem)]">
                Email
              </h2>
              <p>
                <a
                  href={`mailto:${SITE.email}`}
                  className="inline-flex min-h-11 items-center gap-2 text-[1.0625rem] font-semibold text-cocoa underline decoration-kraft-deep underline-offset-[0.22em]"
                >
                  <Mail aria-hidden strokeWidth={1.8} className="size-5" />
                  {SITE.email}
                </a>
              </p>
              <p className="text-[1.0625rem] leading-[1.7] text-brown">
                For orders, include your order number. For a made-to-order piece, tell us the date you need it by.
              </p>
              <p className="text-[1.0625rem] leading-[1.7] text-brown">
                We reply during these hours: <Ph id="contact-hours">[Days and hours the maker replies, e.g. Mon to Sat, 10:00 to 18:00 IST]</Ph>
              </p>
            </section>

            <section aria-labelledby="addr-h" className="space-y-4">
              <h2 id="addr-h" className="font-display text-[clamp(1.875rem,4.2vw,2.5rem)]">
                Business address
              </h2>
              <Ticket head={["Registered address", "India"]} tone="paper" className="max-w-sm">
                <div className="space-y-3 px-3 pt-1 pb-3 text-[15px] text-cocoa">
                  <LegalAddress />
                  <p>
                    Phone: <Ph>[Business phone number]</Ph>
                  </p>
                  <p>
                    GSTIN: <Ph>[GSTIN, or a note that the seller is not registered]</Ph>
                  </p>
                </div>
              </Ticket>
              <p className="text-[15px] leading-relaxed text-brown">
                This is our registered business address. To make a complaint, see the{" "}
                <Link className="font-medium text-cocoa underline" href="/policies/grievance">
                  grievance officer
                </Link>{" "}
                page.
              </p>
            </section>
          </div>

          <section aria-labelledby="form-h" className="lg:pt-1">
            <h2 id="form-h" className="font-display mb-5 text-[clamp(1.875rem,4.2vw,2.5rem)]">
              Send a message
            </h2>
            <ContactForm />
          </section>
        </div>
      </div>
    </div>
  );
}
