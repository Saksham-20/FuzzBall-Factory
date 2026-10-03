import type { Metadata } from "next";
import { Accordion, AccordionItem } from "@/components/ui/Tabs";
import { Prose } from "@/components/content/Prose";
import { ReadLayout } from "@/components/content/ReadLayout";
import { FAQ_GROUPS, faqJsonLd } from "@/components/content/faq";
import { JsonLd } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about lead times, custom work orders and quotes, payments and cash on delivery, international shipping, returns, care.",
  alternates: { canonical: "/faq" },
};

export default function FaqPage() {
  return (
    <>
      <JsonLd data={faqJsonLd()} />
      <ReadLayout
        title="Questions, answered"
        intro="Lead times, custom orders, payments, shipping, returns and care. Can't find yours? Ask on WhatsApp."
        sections={FAQ_GROUPS.map((g) => ({
          id: g.id,
          title: g.title,
          bare: true,
          body: (
            <Accordion type="single" collapsible className="border-t border-line">
              {g.items.map((i) => (
                <AccordionItem key={i.id} value={i.id} title={i.q}>
                  <Prose className="space-y-3 text-base">{i.a}</Prose>
                </AccordionItem>
              ))}
            </Accordion>
          ),
        }))}
      />
    </>
  );
}
