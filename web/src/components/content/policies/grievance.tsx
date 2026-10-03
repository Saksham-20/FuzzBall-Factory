import Link from "next/link";
import { Ticket } from "@/components/brand/Ticket";
import { LegalValue, Ph } from "@/components/content/Placeholder";
import { LegalAddress } from "@/components/content/SellerDetails";
import { TicketForm } from "@/components/support/TicketForm";
import type { PolicyDoc } from "@/components/content/policies/types";
import { LEGAL } from "@/lib/legal";
import { SITE } from "@/lib/site";

// PLACEHOLDER(legal-details): grievance officer name, designation, phone and address. The
// Consumer Protection (E-Commerce) Rules, 2020 require these to be displayed.
// PLACEHOLDER(policy-draft): the whole text is a draft for legal review.

export const grievancePolicy: PolicyDoc = {
  slug: "grievance",
  title: "Grievance officer",
  shortTitle: "Grievance officer",
  description:
    "How to make a complaint to FuzzBall Factory's grievance officer. We acknowledge within 48 hours and resolve within one month. Includes contact details, customer care and how to escalate.",
  intro: "If something went wrong and the normal channels did not fix it, this is who to write to and what happens next.",
  summary: {
    head: "The short version",
    points: [
      "Write to the grievance officer by email or post. Include your order number.",
      "We acknowledge your complaint within 48 hours and send you a copy of it as we recorded it.",
      "We will resolve your complaint within one month of receiving it.",
      "If you are still unhappy, you can go to the National Consumer Helpline or a consumer commission.",
    ],
  },
  sections: [
    {
      id: "officer",
      title: "Our grievance officer",
      body: (
        <>
          <p>
            As required by the Consumer Protection (E-Commerce) Rules, 2020 and the Digital Personal Data Protection Act, 2023, this is the
            person who handles complaints about orders, products, this website and your personal data.
          </p>
          <Ticket head={["Grievance officer", SITE.name]} tone="paper">
            <dl className="grid gap-x-6 gap-y-2 px-3 pt-1 pb-3 text-[15px] sm:grid-cols-[8rem_1fr]">
              <dt className="font-semibold text-cocoa">Name</dt>
              <dd>
                <LegalValue value={LEGAL.grievance.name} label="Grievance officer name" />
              </dd>
              <dt className="font-semibold text-cocoa">Designation</dt>
              <dd>
                <LegalValue value={LEGAL.grievance.designation} label="Designation, e.g. Proprietor" />
              </dd>
              <dt className="font-semibold text-cocoa">Email</dt>
              <dd>
                <a className="font-medium text-cocoa underline" href={`mailto:${LEGAL.grievance.email ?? SITE.email}`}>
                  {LEGAL.grievance.email ?? SITE.email}
                </a>
                {LEGAL.grievance.email ? null : (
                  <>
                    {" "}
                    <Ph>[Confirm a dedicated grievance email]</Ph>
                  </>
                )}
              </dd>
              <dt className="font-semibold text-cocoa">Phone</dt>
              <dd>
                <LegalValue value={LEGAL.grievance.phone} label="Grievance officer phone number" />
              </dd>
              <dt className="font-semibold text-cocoa">Available</dt>
              <dd>
                <LegalValue value={LEGAL.grievance.hours} label="Days and hours the officer can be reached" />
              </dd>
              <dt className="font-semibold text-cocoa">Postal address</dt>
              <dd>
                <LegalAddress />
              </dd>
            </dl>
          </Ticket>
        </>
      ),
    },
    {
      id: "care",
      title: "Customer care",
      body: (
        <>
          <p>For questions about an order that are not a complaint, customer care is the quickest route:</p>
          <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-[8rem_1fr]">
            <dt className="font-semibold text-cocoa">Email</dt>
            <dd>
              <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
            </dd>
            <dt className="font-semibold text-cocoa">Phone</dt>
            <dd>
              <LegalValue value={LEGAL.phone} label="Customer-care phone number" />
            </dd>
            <dt className="font-semibold text-cocoa">Hours</dt>
            <dd>
              <LegalValue value={LEGAL.customerCareHours} label="Customer-care hours" />
            </dd>
            <dt className="font-semibold text-cocoa">WhatsApp</dt>
            <dd>
              <Link href="/contact">Message us from the contact page</Link>
            </dd>
          </dl>
        </>
      ),
    },
    {
      id: "form",
      title: "Make a complaint online",
      body: (
        <>
          <p>This is the quickest way. You get a reference number and a copy of your complaint by email at once, and that email is our acknowledgement.</p>
          <TicketForm
            kind="GRIEVANCE"
            messageLabel="What happened, and what would you like us to do?"
            submitLabel="Send complaint"
            notice={{ what: "name, email, phone, order details and complaint", why: "to look into it, answer you and keep the record the law asks us to keep" }}
            afterSend="We will resolve your complaint within one month."
          />
        </>
      ),
    },
    {
      id: "how",
      title: "Other ways to make a complaint",
      body: (
        <>
          <p>You can also write to the email address above, call, message us on WhatsApp, or post to the address. Whichever you use, we record it in the same register. Please include:</p>
          <ul>
            <li>your name, and the email and phone number on your order or account;</li>
            <li>your order number or work-order number, if you have one;</li>
            <li>what happened and what you would like us to do;</li>
            <li>photos, screenshots or your unboxing video, if they help.</li>
          </ul>
          <p>
            For a data request (access, correction, erasure or withdrawal of consent), say so in the subject line. See the{" "}
            <Link href="/policies/privacy">privacy policy</Link>.
          </p>
        </>
      ),
    },
    {
      id: "timeline",
      title: "What happens next",
      body: (
        <ol>
          <li>
            <strong>Within 48 hours:</strong> we acknowledge your complaint, give you a reference to quote, and send you a copy of your complaint
            as we recorded it. A complaint made on WhatsApp, by phone or by post is written into the same register.
          </li>
          <li>
            <strong>While we look into it:</strong> we may ask you for more detail or photos.
          </li>
          <li>
            <strong>Within one month of receiving it:</strong> we will resolve your complaint and tell you what we found and what we did. If we
            cannot resolve it in that time, we will tell you why and what remains.
          </li>
        </ol>
      ),
    },
    {
      id: "escalate",
      title: "If you are still not satisfied",
      body: (
        <>
          <ul>
            <li>
              <strong>National Consumer Helpline:</strong> call 1915, or use{" "}
              <a href="https://consumerhelpline.gov.in" target="_blank" rel="noopener noreferrer">
                consumerhelpline.gov.in
              </a>
              .
            </li>
            <li>
              <strong>Consumer commission:</strong> you can file a complaint under the Consumer Protection Act, 2019, including online at{" "}
              <a href="https://edaakhil.nic.in" target="_blank" rel="noopener noreferrer">
                edaakhil.nic.in
              </a>
              .
            </li>
            <li>
              <strong>Data complaints:</strong> after using our grievance process, you can complain to the Data Protection Board of India.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "seller",
      title: "Seller details",
      body: (
        <p>
          This website is operated by <LegalValue value={LEGAL.legalName} label="Legal business name" />, trading as {SITE.name}. Country of origin of our products: India. For full
          seller details see the <Link href="/policies/terms">terms and conditions</Link>.
        {LEGAL.darkPatternAudit ? (
            <>
              {" "}
              We last audited this website for the misleading design practices listed in the Central Consumer Protection Authority&apos;s 2023 dark-pattern
              guidelines on {LEGAL.darkPatternAudit}.
            </>
          ) : null}
        </p>
      ),
    },
  ],
};
