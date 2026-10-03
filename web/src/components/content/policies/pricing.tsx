import Link from "next/link";
import { ShippingRates } from "@/components/content/ShippingRates";
import { GstLine } from "@/components/content/SellerDetails";
import type { PolicyDoc } from "@/components/content/policies/types";
import { LEGAL } from "@/lib/legal";
import { SAMPLE_SETTINGS, SITE } from "@/lib/site";

// PLACEHOLDER(legal-details): tax wording follows LEGAL.gstRegistered.
// PLACEHOLDER(policy-draft): draft for legal review. Razorpay's activation checks ask for a "Pricing details" page.

const dep = SAMPLE_SETTINGS.depositPct;

export const pricingPolicy: PolicyDoc = {
  slug: "pricing",
  title: "Pricing details",
  shortTitle: "Pricing details",
  description:
    `How FuzzBall Factory prices work: rupee prices, tax, shipping charges in India${SITE.shipsInternational ? " and abroad" : ""}, gift wrap, cash on delivery fee, work order quotes and the advance, and what is added at checkout.`,
  intro: "What you pay and what is added before you pay. Nothing is added after you click pay.",
  summary: {
    head: "The short version",
    points: [
      SITE.shipsInternational ? "All prices are in Indian rupees (INR). You pay in INR, including on international orders." : "All prices are in Indian rupees (INR).",
      "Shipping, gift wrap and any cash on delivery fee show as separate lines before you pay.",
      "Custom work orders are priced by a written quote. You pay an advance to start and the balance before we ship.",
      ...(SITE.shipsInternational ? ["Import duties and taxes charged by your country are not in our price."] : []),
    ],
  },
  sections: [
    {
      id: "prices",
      title: "Product prices",
      body: (
        <>
          <p>
            The price on a product page is the price of one piece in Indian rupees. Where a piece comes in different sizes or colours, the price
            for your choice is shown before you add it to the cart. If a previous price is shown, it is the lowest price the piece was sold at in the
            30 days before.
          </p>
          <p>
            <strong>Tax.</strong> <GstLine />{" "}
            {LEGAL.gstRegistered === null ? null : LEGAL.gstRegistered
              ? "Where GST applies it is included in the price shown."
              : "The price you see is the price you pay for the piece."}
          </p>
        </>
      ),
    },
    {
      id: "shipping",
      title: "Shipping charges",
      body: (
        <>
          <p>Shipping is charged per order, by destination. These are the current charges:</p>
          <ShippingRates part="india" />
          {SITE.shipsInternational ? <ShippingRates part="international" /> : null}
          <p>
            The exact charge for your address is shown at checkout before you pay. See the <Link href="/policies/shipping">shipping policy</Link>{" "}
            for delivery times{SITE.shipsInternational ? " and for import duties on international parcels" : ""}.
          </p>
        </>
      ),
    },
    {
      id: "work-orders",
      title: "Custom work orders",
      body: (
        <>
          <p>
            A work order is priced by a written quote that lists what is included, the number of revisions and the timeline. A quote is valid
            for 7 days. When you accept it, you pay a {dep}% advance to start, and the balance before we ship. Asking for a quote is free, and
            declining one costs nothing. The price in an accepted quote does not change unless you ask for something outside it, and we tell you
            the price first.
          </p>
          <p>
            What happens to your money if you cancel is in the <Link href="/policies/refund">cancellation and refund policy</Link>.
          </p>
        </>
      ),
    },
    {
      id: "payment",
      title: "Payment methods and fees",
      body: (
        <>
          <p>
            Online payments by UPI, cards and netbanking are processed by Razorpay. We do not add a fee for paying online. Cash on delivery, where
            offered, has its own fee that is shown at checkout; it is available for ready-to-ship pieces in India only.
          </p>
          <p>
            Coupons are applied at checkout and the discount is shown as its own line. A wrongly shown price can be corrected: see the{" "}
            <Link href="/policies/terms">terms</Link>.
          </p>
        </>
      ),
    },
  ],
};
