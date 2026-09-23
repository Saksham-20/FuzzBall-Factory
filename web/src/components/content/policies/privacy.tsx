import Link from "next/link";
import { DataTable } from "@/components/content/Prose";
import { Ph } from "@/components/content/Placeholder";
import { SellerDetails } from "@/components/content/SellerDetails";
import type { PolicyDoc } from "@/components/content/policies/types";
import { SITE } from "@/lib/site";

// PLACEHOLDER(legal-details): data fiduciary identity and retention periods.
// PLACEHOLDER(policy-draft): the whole text is a draft for legal review against the Digital
// Personal Data Protection Act, 2023 and the rules made under it. Confirm the list of service
// providers below against what is actually deployed.

export const privacyPolicy: PolicyDoc = {
  slug: "privacy",
  title: "Privacy policy",
  shortTitle: "Privacy policy",
  description:
    "What personal data FuzzBall Factory collects, why, who it is shared with (Razorpay, couriers, email provider), how long it is kept, and how to ask for access, correction or deletion under India's DPDP Act, 2023.",
  intro:
    "This explains what personal data we collect when you shop or ask for a custom piece, why we need it, who sees it, and how you can control it.",
  summary: {
    head: "The short version",
    points: [
      "We collect what we need to make, ship and support your order. We do not sell your data.",
      "Payments are handled by Razorpay. We never see your card number, UPI PIN or OTP.",
      "Couriers and our email provider get only what they need to do their job.",
      "You can ask to see, correct or delete your data, or withdraw consent, at any time. Write to our grievance officer.",
    ],
  },
  sections: [
    {
      id: "who",
      title: "Who is responsible for your data",
      body: (
        <>
          <p>
            For the purposes of the Digital Personal Data Protection Act, 2023 (&quot;DPDP Act&quot;), the data fiduciary is the seller below. In
            this policy, &quot;we&quot; means them. &quot;You&quot; is the person whose data it is (the data principal).
          </p>
          <SellerDetails />
        </>
      ),
    },
    {
      id: "collect",
      title: "What we collect",
      body: (
        <>
          <ul>
            <li>
              <strong>Account:</strong> your name, email address, phone number and a password (stored only as a one-way hash).
            </li>
            <li>
              <strong>Orders:</strong> delivery and billing address, the items you ordered, gift notes, order and payment status, and the
              payment reference from Razorpay. We do not receive or store your full card number, UPI PIN, CVV or OTP.
            </li>
            <li>
              <strong>Custom work orders:</strong> what you describe, reference images you upload, colours, measurements, budget, needed-by
              date, and the messages and quotes exchanged with us.
            </li>
            <li>
              <strong>Messages to us:</strong> what you send through the contact form, by email or on WhatsApp, including your name, number and
              anything you tell us.
            </li>
            <li>
              <strong>Reviews:</strong> if you write a review, the text and any photos you add.
            </li>
            <li>
              <strong>Technical data:</strong> basic information your browser sends (IP address, device and browser type, pages requested) that
              our hosting keeps in server logs, and the small items stored in your browser (see cookies and local storage).
            </li>
          </ul>
          <p>
            Please do not send us sensitive data we do not need, such as government ID numbers or health details, in a work order or a message.
          </p>
        </>
      ),
    },
    {
      id: "why",
      title: "Why we use it",
      body: (
        <>
          <DataTable
            caption="Purposes for which personal data is used"
            head={["Purpose", "What it covers"]}
            rows={[
              ["Sell and deliver your order", "Taking payment, making and packing the piece, booking the courier, tracking, returns and refunds."],
              ["Custom work orders", "Preparing quotes, running the quote conversation, showing progress photos, taking the advance and balance."],
              ["Talk to you", "Order and work-order updates by email and WhatsApp, and replies to your questions."],
              ["Keep your account", "Sign in, saved addresses, wishlist and order history."],
              ["Prevent fraud and misuse", "Checking payments, spotting fake or repeated cash on delivery refusals, protecting accounts."],
              ["Meet legal duties", "Tax and accounting records, and responding to lawful requests from authorities."],
              ["Marketing (only if you agree)", "News of new drops or offers by email. Optional and separate from your order."],
            ]}
          />
          <p>
            We use your data only for these purposes. If we want to use it for something new, we will ask you first where the law requires it.
          </p>
        </>
      ),
    },
    {
      id: "consent",
      title: "Your consent",
      body: (
        <>
          <p>
            We rely on your consent when you give us your data for a stated purpose: by creating an account, placing an order, submitting a
            form, or ticking a box. Marketing emails are only sent if you say yes, and every message has an unsubscribe link.
          </p>
          <p>
            In some cases the law lets us use data without fresh consent, for example to complete an order you asked for, or to keep records that
            tax law requires.
          </p>
          <p>
            You can <strong>withdraw consent at any time</strong> by writing to us (see &quot;Your rights&quot;). Withdrawing does not undo what we
            did before, and if the data is needed to deliver something you have already ordered, we may not be able to finish that order.
          </p>
          <p>
            This notice is in English. You may ask us for it in any other language listed in the Eighth Schedule to the Constitution of India.
          </p>
        </>
      ),
    },
    {
      id: "sharing",
      title: "Who we share it with",
      body: (
        <>
          <p>We do not sell your personal data. We share it only with the people who help us serve you:</p>
          <DataTable
            caption="Who personal data is shared with"
            head={["Who", "What they get", "Why"]}
            rows={[
              ["Razorpay", "Your name, contact details, order amount and payment details you enter on their page", "To take payment and process refunds"],
              ["Courier and shipping partners", "Your name, delivery address and phone number, and the parcel details", "To deliver your parcel and let you track it"],
              ["Email provider", "Your email address, name and the content of order emails", "To send order, work-order and account emails"],
              ["Hosting, storage and image services", "Data stored on the site, including images you upload", "To run the website securely"],
              ["WhatsApp (Meta)", "What you send us on WhatsApp, including your number", "Only when you choose to message us there"],
              ["Authorities", "What the law requires", "Only when legally required to disclose it"],
            ]}
          />
          <p>
            These providers process data on our behalf and under their own privacy terms. Some of them, and our international couriers, may
            handle data outside India. We will make sure any transfer follows the DPDP Act and the rules made under it.
          </p>
        </>
      ),
    },
    {
      id: "retention",
      title: "How long we keep it",
      body: (
        <>
          <p>We keep data only as long as we need it for the purpose it was collected, or as the law requires:</p>
          <ul>
            <li>
              <strong>Account data:</strong> until you delete your account or ask us to.
            </li>
            <li>
              <strong>Order and payment records, invoices:</strong> for <Ph>[retention period, e.g. 8 years, confirm with the accountant]</Ph>,
              because tax and accounting law requires us to keep them.
            </li>
            <li>
              <strong>Custom work order messages and reference images:</strong> for <Ph>[retention period, e.g. 2 years]</Ph> after the work order
              closes, in case of questions or claims about the piece.
            </li>
            <li>
              <strong>Contact form messages and emails:</strong> for <Ph>[retention period, e.g. 2 years]</Ph>.
            </li>
            <li>
              <strong>Server logs:</strong> for a short period, then deleted.
            </li>
          </ul>
          <p>After that, we delete the data or make it anonymous.</p>
        </>
      ),
    },
    {
      id: "rights",
      title: "Your rights",
      body: (
        <>
          <p>Under the DPDP Act you can:</p>
          <ul>
            <li>ask for a summary of the personal data we hold about you and how it is used;</li>
            <li>ask us to correct or complete data that is wrong or out of date;</li>
            <li>ask us to erase your data, when it is no longer needed for the purpose or for a legal reason;</li>
            <li>withdraw your consent;</li>
            <li>nominate another person to exercise these rights if you die or cannot act for yourself;</li>
            <li>get your complaint about your data looked into.</li>
          </ul>
          <p>
            To use any of these, email <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or write to our{" "}
            <Link href="/policies/grievance">grievance officer</Link>. Tell us what you want and the email or phone number on your account so we
            can confirm it is you. We acknowledge within 48 hours and respond within one month. You can delete your account details from your
            account page where that option is shown.
          </p>
          <p>
            If you are not satisfied with our response, you can complain to the Data Protection Board of India once you have used our grievance
            process.
          </p>
          <p>Please give us true and complete data, and do not give us anyone else&apos;s data without their permission.</p>
        </>
      ),
    },
    {
      id: "cookies",
      title: "Cookies and local storage",
      body: (
        <>
          <p>
            We keep to a minimum what we store in your browser. It is used to run the shop, not to follow you across other sites.
          </p>
          <DataTable
            caption="Items stored in your browser"
            head={["What", "Why", "How long"]}
            rows={[
              ["Sign-in session", "Keeps you signed in (essential)", "Until you sign out or the session expires"],
              ["Cart and wishlist", "Remembers what you added, on this device (essential)", "Until you clear it or the browser data"],
              ["Display choices", "Small interface settings, such as whether a notice was shown", "Until you clear browser data"],
            ]}
          />
          <p>
            We do not currently use advertising trackers. If we add analytics that use cookies, we will update this page and ask for your
            consent where needed. You can clear or block browser storage in your browser settings, but the cart and sign-in will then not work.
          </p>
        </>
      ),
    },
    {
      id: "security",
      title: "How we protect it",
      body: (
        <p>
          The site uses an encrypted (HTTPS) connection. Passwords are stored as hashes, and access to customer data is limited to the people who
          need it. No system is perfectly secure. If a breach affecting your data happens, we will tell you and the authorities as the law
          requires.
        </p>
      ),
    },
    {
      id: "children",
      title: "Children",
      body: (
        <p>
          The shop is for adults. We do not knowingly collect data from anyone under 18 without a parent or guardian&apos;s consent. If you think a
          child has given us data, tell us and we will delete it.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes and contact",
      body: (
        <p>
          When we change this policy, we update the date at the top and, for significant changes, tell you by email. Questions or requests:{" "}
          <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or the <Link href="/policies/grievance">grievance officer</Link>.
        </p>
      ),
    },
  ],
};
