import Link from "next/link";
import { Ph } from "@/components/content/Placeholder";
import { SellerDetails } from "@/components/content/SellerDetails";
import type { PolicyDoc } from "@/components/content/policies/types";
import { SAMPLE_SETTINGS, SITE } from "@/lib/site";
import { formatINR } from "@/lib/format";

// PLACEHOLDER(legal-details): seller identity, tax status and court jurisdiction.
// PLACEHOLDER(policy-draft): the whole text is a draft for legal review.

const dep = SAMPLE_SETTINGS.depositPct;

export const termsPolicy: PolicyDoc = {
  slug: "terms",
  title: "Terms and conditions",
  shortTitle: "Terms and conditions",
  description:
    "The terms for buying from FuzzBall Factory: orders, pricing and payment, custom work orders and quotes, original designs only, handmade colour variance, and governing law in India.",
  intro: "The rules for using this website and buying from us. We have tried to keep them readable.",
  summary: {
    head: "The short version",
    points: [
      "Everything is handmade, so small differences in colour and size are normal.",
      `Custom work orders follow a quote. A ${dep}% advance starts the work, and the balance is due before we ship.`,
      "We make original designs only. We do not make licensed or copyrighted characters.",
      "These terms are governed by the laws of India. Your rights as a consumer are not reduced.",
    ],
  },
  sections: [
    {
      id: "about",
      title: "About these terms",
      body: (
        <>
          <p>
            By browsing this website, creating an account or placing an order, you agree to these terms and to our{" "}
            <Link href="/policies/privacy">privacy policy</Link>, <Link href="/policies/shipping">shipping policy</Link> and{" "}
            <Link href="/policies/refund">cancellation and refund policy</Link>, which are part of them. If you do not agree, please do not use
            the site.
          </p>
          <p>This website is operated by:</p>
          <SellerDetails />
        </>
      ),
    },
    {
      id: "eligibility",
      title: "Who can buy",
      body: (
        <ul>
          <li>You must be 18 or older, or use the site with a parent or guardian who agrees to these terms.</li>
          <li>Give us true details: name, address, phone and email. We use them to deliver and to reach you about your order.</li>
          <li>Keep your password private. You are responsible for what happens under your account. Tell us at once if you think it was misused.</li>
        </ul>
      ),
    },
    {
      id: "products",
      title: "Our products",
      body: (
        <>
          <p>
            Every piece is crocheted by hand in India. Handmade means each piece is a little different:
          </p>
          <ul>
            <li>
              <strong>Colour.</strong> Yarn dye lots and your screen change how colours look. Photos are a guide, not a guarantee of an exact
              shade.
            </li>
            <li>
              <strong>Size and shape.</strong> Sizes are given in cm and are approximate. Expect a small difference between two pieces of the same
              design.
            </li>
            <li>
              <strong>Materials.</strong> The fibre is listed on the product page. Tell us before ordering if you have an allergy to any fibre.
            </li>
            <li>
              <strong>Safety.</strong> Plushies and small parts are not toys for children under 3 unless the product page says they are made for
              that age. Supervise young children. Read the care notes.
            </li>
          </ul>
          <p>We may stop selling a product or change its description at any time. A product marked sold out cannot be ordered.</p>
        </>
      ),
    },
    {
      id: "pricing",
      title: "Pricing and payment",
      body: (
        <>
          <ul>
            <li>
              Prices are in Indian rupees (INR). If we show an approximate price in another currency, it is only a guide. You pay in INR.
            </li>
            <li>
              <Ph>[State whether prices include GST or other taxes, as applicable to the seller]</Ph>. The price of the item, shipping, gift
              wrap and any cash on delivery fee are shown separately before you pay.
            </li>
            <li>
              Online payments are processed by Razorpay, using UPI, cards, netbanking and other methods shown at checkout. We do not see or store
              your full card number, UPI PIN or OTP.
            </li>
            <li>
              Cash on delivery is available for ready-to-ship items in India, for orders up to {formatINR(SAMPLE_SETTINGS.codCap)}, with a fee
              of {formatINR(SAMPLE_SETTINGS.codFee)}. We may confirm the order with you on WhatsApp before dispatch. It is not available for
              made-to-order pieces, custom work orders or international orders.
            </li>
            <li>
              Coupons have their own conditions, cannot be exchanged for cash, and may be withdrawn or limited to certain products.
            </li>
            <li>
              If a price is shown wrongly, we may cancel the order and refund you in full. We will tell you before we do.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "orders",
      title: "Placing an order",
      body: (
        <>
          <p>
            Placing an order is an offer to buy. It becomes a contract when we confirm it by email or on your order page. We may decline or cancel an
            order, for example if stock has run out, the address cannot be served, we cannot verify payment, or we suspect misuse. If we cancel
            after you have paid, you are refunded in full.
          </p>
          <p>
            One-of-a-kind pieces exist once. When you start checkout we hold the piece for you for a short time (about 10 minutes). If you do not
            complete payment in that time, it is released for others.
          </p>
          <p>
            Made-to-order pieces show a lead time. It is our best estimate of dispatch, not a guaranteed delivery date. See the{" "}
            <Link href="/policies/shipping">shipping policy</Link>.
          </p>
        </>
      ),
    },
    {
      id: "custom",
      title: "Custom work orders and quotes",
      body: (
        <>
          <p>
            You can ask for a piece made to your idea, or a change to an existing product (colour, size, name or details). This is how it works:
          </p>
          <ol>
            <li>
              <strong>Request.</strong> You describe what you want, with reference images, colours, size, budget and the date you need it by.
              A request is not an order and does not oblige either of us.
            </li>
            <li>
              <strong>Quote.</strong> We may accept, decline or quote for your request. A quote states the price, what is included, the number of
              revisions and the estimated timeline. It is valid for 7 days.
            </li>
            <li>
              <strong>Counter.</strong> You may counter a quote up to two times. We may accept your counter, quote again or decline.
            </li>
            <li>
              <strong>Accept and pay.</strong> The work order becomes a binding agreement when you accept a quote and pay the {dep}% advance.
            </li>
            <li>
              <strong>Making.</strong> We share progress photos on your work order. The estimated timeline starts when the advance is paid.
            </li>
            <li>
              <strong>Approval and balance.</strong> When the piece is ready, you approve it and pay the balance. We ship after the balance is
              paid.
            </li>
          </ol>
          <p>
            The advance is non-refundable once work has started. Changes outside the scope in the quote, or after approval, may be charged.
            Refund details are in the <Link href="/policies/refund">cancellation and refund policy</Link>.
          </p>
          <p>
            Handmade work depends on your references. If you send a photo or description, we make our own version of it. We cannot promise an
            exact copy.
          </p>
        </>
      ),
    },
    {
      id: "ip",
      title: "Original designs and intellectual property",
      body: (
        <>
          <p>
            <strong>We make original designs only.</strong> We do not make or sell licensed, trademarked or copyrighted characters such as
            those from films, cartoons, games or brands, and we do not copy other makers&apos; patterns. We will decline such requests. If you
            send us a reference, you confirm you have the right to share it.
          </p>
          <p>
            The designs, patterns, photographs, text and logos on this website belong to us or our licensors. You may not copy, sell or reuse them
            without our written permission. Buying a piece gives you the physical piece for your personal use. It does not give you the right to
            copy the design for sale.
          </p>
          <p>
            We may photograph pieces we make, including custom ones, and show the photos on this site and on our social media. Tell us in advance
            if you want a custom piece kept private, and we will not share it.
          </p>
        </>
      ),
    },
    {
      id: "conduct",
      title: "Using the website",
      body: (
        <>
          <p>Please do not:</p>
          <ul>
            <li>use the site for anything unlawful, or to harm, harass or mislead anyone;</li>
            <li>try to break, overload or gain unauthorised access to the site, its accounts or its data;</li>
            <li>use bots or scrapers, or copy content in bulk;</li>
            <li>post reviews or messages that are false, abusive, or that you do not have the right to post.</li>
          </ul>
          <p>
            If you post a review or photo, you allow us to display it on the site. We may remove content that breaks these terms.
          </p>
        </>
      ),
    },
    {
      id: "third-parties",
      title: "Third-party services",
      body: (
        <p>
          We rely on others for payments, courier delivery, email and hosting. Their services follow their own terms, and delays or faults on
          their side are outside our control. Links to other websites, including Instagram and WhatsApp, are for your convenience; we do not
          control them.
        </p>
      ),
    },
    {
      id: "liability",
      title: "Our responsibility",
      body: (
        <>
          <p>
            We take care to describe and make every piece well, and to give accurate information on this website. To the extent the law allows, we are
            not liable for indirect or consequential loss, or for events outside our reasonable control. Our total liability for an order is limited to
            the amount you paid for it.
          </p>
          <p>
            Nothing in these terms takes away any right you have under the Consumer Protection Act, 2019, the Consumer Protection (E-Commerce)
            Rules, 2020, or any other law that cannot be excluded by agreement.
          </p>
        </>
      ),
    },
    {
      id: "changes",
      title: "Changes to these terms",
      body: (
        <p>
          We may update these terms. The date at the top shows when they last changed. The terms in force when you place an order apply to that
          order.
        </p>
      ),
    },
    {
      id: "law",
      title: "Governing law and disputes",
      body: (
        <>
          <p>
            These terms are governed by the laws of India. Subject to the next paragraph, the courts at <Ph>[City, State for jurisdiction]</Ph> have
            jurisdiction over disputes arising from them.
          </p>
          <p>
            As a consumer, you can also approach the consumer commission that has jurisdiction under the Consumer Protection Act, 2019, and the
            National Consumer Helpline (1915). We would like the chance to fix things first: please use our{" "}
            <Link href="/policies/grievance">grievance officer</Link> page.
          </p>
        </>
      ),
    },
    {
      id: "contact",
      title: "Contact",
      body: (
        <p>
          Questions about these terms: <a href={`mailto:${SITE.email}`}>{SITE.email}</a>, or the <Link href="/contact">contact page</Link>.
        </p>
      ),
    },
  ],
};
