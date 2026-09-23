import Link from "next/link";
import { Ticket } from "@/components/brand/Ticket";
import { Ph } from "@/components/content/Placeholder";
import { LegalAddress } from "@/components/content/SellerDetails";
import type { PolicyDoc } from "@/components/content/policies/types";
import { SITE } from "@/lib/site";

// PLACEHOLDER(legal-details): grievance officer name, designation, phone and address. The
// Consumer Protection (E-Commerce) Rules, 2020 require these to be displayed.
// PLACEHOLDER(policy-draft): the whole text is a draft for legal review.

export const grievancePolicy: PolicyDoc = {
  slug: "grievance",
  title: "Grievance officer",
  shortTitle: "Grievance officer",
  description:
    "How to make a complaint to FuzzBall Factory's grievance officer. We acknowledge within 48 hours and resolve within one month. Includes contact details and how to escalate.",
  intro: "If something went wrong and the normal channels did not fix it, this is who to write to and what happens next.",
  summary: {
    head: "The short version",
    points: [
      "Write to the grievance officer by email or post. Include your order number.",
      "We acknowledge your complaint within 48 hours.",
      "We resolve it within one month of receiving it.",
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
                <Ph>[Grievance officer name]</Ph>
              </dd>
              <dt className="font-semibold text-cocoa">Designation</dt>
              <dd>
                <Ph>[Designation, e.g. Proprietor]</Ph>
              </dd>
              <dt className="font-semibold text-cocoa">Email</dt>
              <dd>
                <a className="font-medium text-cocoa underline" href={`mailto:${SITE.email}`}>
                  {SITE.email}
                </a>{" "}
                <Ph>[Confirm a dedicated grievance email]</Ph>
              </dd>
              <dt className="font-semibold text-cocoa">Phone</dt>
              <dd>
                <Ph>[Grievance officer phone number]</Ph>
              </dd>
              <dt className="font-semibold text-cocoa">Available</dt>
              <dd>
                <Ph>[Days and hours the officer can be reached]</Ph>
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
      id: "how",
      title: "How to make a complaint",
      body: (
        <>
          <p>Write to the email address above, or post to the address. Please include:</p>
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
            <strong>Within 48 hours:</strong> we acknowledge your complaint and give you a reference to quote.
          </li>
          <li>
            <strong>While we look into it:</strong> we may ask you for more detail or photos.
          </li>
          <li>
            <strong>Within one month of receiving it:</strong> we tell you what we found and what we will do about it. If we cannot resolve it in
            that time, we will tell you why and what remains.
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
          This website is operated by <Ph>[Legal business name]</Ph>, trading as {SITE.name}. Country of origin of our products: India. For full
          seller details see the <Link href="/policies/terms">terms and conditions</Link>.
        </p>
      ),
    },
  ],
};
