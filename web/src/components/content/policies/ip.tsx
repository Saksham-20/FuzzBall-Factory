import Link from "next/link";
import { LegalValue } from "@/components/content/Placeholder";
import type { PolicyDoc } from "@/components/content/policies/types";
import { TicketForm } from "@/components/support/TicketForm";
import { LEGAL } from "@/lib/legal";
import { SITE } from "@/lib/site";

// PLACEHOLDER(legal-details): the takedown contact.
// PLACEHOLDER(policy-draft): the wording is from docs/LEGAL_REVIEW.md section 4 and needs a lawyer's sign-off.

export const ipPolicy: PolicyDoc = {
  slug: "ip",
  title: "Intellectual property and takedown",
  shortTitle: "Intellectual property",
  description:
    "FuzzBall Factory is an independent handmade studio, not affiliated with any game, anime, film or toy company. How to report something that infringes your rights.",
  intro: "Who makes our designs, what we do not sell, and how to tell us if you think something here is yours.",
  summary: {
    head: "The short version",
    points: [
      "Everything is handmade by us. We do not sell official or licensed merchandise.",
      "If you think something on this site infringes your rights, write to us. We acknowledge within 48 hours.",
    ],
  },
  sections: [
    {
      id: "independent",
      title: "An independent studio",
      body: (
        <p>
          {SITE.name} is an independent studio. Everything we sell is handmade by us. We are not affiliated with, endorsed by or licensed by any
          game, anime, film, television or toy company, and we do not sell official or licensed merchandise.
        </p>
      ),
    },
    {
      id: "report",
      title: "If you think something here infringes your rights",
      body: (
        <>
          <p>
            Write to <LegalValue value={LEGAL.ipContactEmail} label="IP contact email" /> or use the form below. Include:
          </p>
          <ul>
            <li>your name and contact details;</li>
            <li>the work you own, and proof of ownership;</li>
            <li>the web address of the item you are writing about;</li>
            <li>a statement that you have a good-faith belief it is unauthorised;</li>
            <li>a statement that the information you give is accurate.</li>
          </ul>
          <TicketForm
            kind="IP_NOTICE"
            withReference={false}
            messageLabel="Your notice"
            messageHint="Say which work is yours, where you see it here (the address of the page), and that you believe in good faith it is unauthorised and that what you say is accurate."
            submitLabel="Send notice"
            notice={{ what: "name, email, phone and notice", why: "to review your notice and keep a record of it and its outcome" }}
            afterSend="We acknowledge within 48 hours and review within 7 days."
          />
        </>
      ),
    },
    {
      id: "what-we-do",
      title: "What we do with a notice",
      body: (
        <ol>
          <li>
            <strong>Within 48 hours:</strong> we acknowledge your notice and give you a reference.
          </li>
          <li>
            <strong>Within 7 days:</strong> we review it. Where it appears valid, we remove or suspend the listing.
          </li>
          <li>We keep a record of each notice and its outcome.</li>
          <li>If you believe a removal was a mistake, you can reply with a counter-notice, and we will look again.</li>
        </ol>
      ),
    },
    {
      id: "our-content",
      title: "Our own designs and photos",
      body: (
        <p>
          The designs, patterns, photographs, text and logos on this website belong to us. You may not copy, sell or reuse them without our written
          permission. See the <Link href="/policies/terms">terms</Link> for what buying a piece does and does not include.
        </p>
      ),
    },
  ],
};
