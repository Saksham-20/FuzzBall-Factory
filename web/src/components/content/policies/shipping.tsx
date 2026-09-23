import Link from "next/link";
import { DataTable } from "@/components/content/Prose";
import { Ph } from "@/components/content/Placeholder";
import { LegalAddress } from "@/components/content/SellerDetails";
import { ShippingRates } from "@/components/content/ShippingRates";
import type { PolicyDoc } from "@/components/content/policies/types";
import { SITE } from "@/lib/site";

// PLACEHOLDER(legal-details): seller identity below.
// PLACEHOLDER(policy-draft): the whole text is a draft for legal review.
// PLACEHOLDER(copy-leadtimes): dispatch times are sample values; real ones live on each product.
// PLACEHOLDER(shipping-rates): courier partner, transit estimates and rates are sample values.

export const shippingPolicy: PolicyDoc = {
  slug: "shipping",
  title: "Shipping policy",
  shortTitle: "Shipping policy",
  description:
    "Where FuzzBall Factory ships, dispatch times for ready-to-ship and made-to-order crochet, shipping charges in India and abroad, tracking, and what to do if a parcel arrives damaged.",
  intro: "How your order gets from our hooks to your door: what we ship, when it leaves, what it costs and what to do if something goes wrong.",
  summary: {
    head: "The short version",
    points: [
      "Ready-to-ship pieces leave in about 1 to 2 business days. Made-to-order pieces are crocheted after you order, so they take longer. The exact time is on the product page and at checkout.",
      "We ship across India and to selected countries. Prices are in Indian rupees.",
      "You get a tracking link once your parcel is handed to the courier.",
      "Please record a video while opening your parcel. It is the fastest way to sort out any damage.",
    ],
  },
  sections: [
    {
      id: "who-ships",
      title: "Who ships your order",
      body: (
        <>
          <p>
            Orders on this website are sold and shipped by <Ph>[Legal business name]</Ph>, trading as {SITE.name} (&quot;we&quot;,
            &quot;us&quot;). Every parcel is packed and dispatched from India.
          </p>
          <p>Dispatch address:</p>
          <LegalAddress className="-mt-2 not-italic leading-relaxed" />
        </>
      ),
    },
    {
      id: "where-we-ship",
      title: "Where we ship",
      body: (
        <>
          <p>
            We ship to serviceable PIN codes across India, and to the countries listed in the international table below. Not every
            PIN code or country can be reached by our courier partners. Enter your address at checkout and it will tell you whether we can
            deliver there.
          </p>
          <p>
            We do not ship to addresses that our courier cannot serve, to P.O. boxes, or to countries where the parcel would be restricted by
            law.
          </p>
        </>
      ),
    },
    {
      id: "dispatch-times",
      title: "Dispatch times",
      body: (
        <>
          <p>
            Every piece is crocheted by hand, so we split orders into three kinds. The kind is always shown on the product page, in your
            cart and at checkout, along with an estimated dispatch date.
          </p>
          <div data-placeholder="copy-leadtimes" className="relative">
            <DataTable
              caption="Dispatch time by kind of order"
              head={["Kind of order", "Leaves us within"]}
              rows={[
                ["Ready to ship", "1 to 2 business days after your payment is confirmed"],
                ["Made to order", "4 to 10 business days after your payment is confirmed. The exact number is on the product page."],
                ["Custom work order", "The timeline in your accepted quote. Work starts after the advance is paid, and the balance is due before we ship."],
              ]}
            />
          </div>
          <p>
            Dispatch time is the time we take to make, pack and hand the parcel to the courier. It is not the delivery time. Business days
            are working days and exclude Sundays and public holidays.
          </p>
          <p>
            If an order will leave later than the date we showed you, we will tell you on WhatsApp or by email before the date passes, and you
            can choose to wait or cancel for a full refund.
          </p>
          <p>
            If your order contains both a ready-to-ship piece and a made-to-order piece, we send everything together when the longer item is
            finished, unless you ask us on WhatsApp to send the ready piece first (extra shipping may apply).
          </p>
        </>
      ),
    },
    {
      id: "courier",
      title: "Courier and delivery time",
      body: (
        <>
          <p>
            We ship through third-party courier partners, currently <Ph id="shipping-rates">[Courier partner or shipping aggregator]</Ph>.
            We choose the courier that serves your address best, and we may change courier partners without notice.
          </p>
          <p>
            Once a parcel is handed over, delivery within India usually takes 3 to 7 business days, depending on how far it travels and whether
            your PIN code is in a remote area. These are estimates by the courier, not promises. Weather, strikes, festivals and sale seasons
            can slow things down.
          </p>
        </>
      ),
    },
    {
      id: "charges-india",
      title: "Shipping charges in India",
      body: (
        <>
          <ShippingRates part="india" />
          <p>
            The shipping charge, any gift wrap and the cash on delivery fee are shown as separate lines in your cart and at checkout before
            you pay. Cash on delivery is available in India for ready-to-ship pieces only, up to a limit shown at checkout. It is never
            available for made-to-order pieces or custom work orders.
          </p>
        </>
      ),
    },
    {
      id: "international",
      title: "International shipping",
      body: (
        <>
          <p>
            We ship to the countries below. Prices are in Indian rupees, and the rate at checkout is the charge for your parcel. The rate
            depends on the zone and the parcel weight, including volumetric weight for bulky items such as plushies and bouquets.
          </p>
          <ShippingRates part="international" />
          <ul>
            <li>
              <strong>Customs, duties and taxes.</strong> Import duties, VAT, GST-equivalent taxes and courier handling fees charged by the
              destination country are not included in our price. They are the buyer&apos;s responsibility and are collected by the courier
              or customs authority.
            </li>
            <li>
              <strong>Customs forms.</strong> We declare the contents and value of the parcel truthfully, as required by law. We cannot
              change the declared value on request.
            </li>
            <li>
              <strong>No cash on delivery.</strong> International orders are prepaid only.
            </li>
            <li>
              <strong>Refused or unclaimed parcels.</strong> If a parcel is returned to us because it was refused, unclaimed or held by
              customs, we refund the item price after it reaches us, less the shipping charges both ways and any duties we had to pay.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "packing",
      title: "Packing and gift wrap",
      body: (
        <p>
          Pieces are packed in snug boxes or mailers so they arrive in shape. Bouquets are sleeved to protect the stems. Add gift wrap and
          a note at checkout, and we will leave the price off the packing slip. Gift wrap has its own charge, shown above.
        </p>
      ),
    },
    {
      id: "tracking",
      title: "Tracking your order",
      body: (
        <>
          <p>
            When your parcel is handed to the courier, we send the courier name and tracking link by email and, if you have given us your
            number, on WhatsApp. Your order page also shows every step, from placed to delivered.
          </p>
          <p>
            You can look up any order on the <Link href="/track">Track order</Link> page with your order number and the phone number used at
            checkout, or sign in and open it from your account.
          </p>
        </>
      ),
    },
    {
      id: "address",
      title: "Address and delivery attempts",
      body: (
        <>
          <p>
            Please check your address, PIN code and phone number before paying. The courier needs a working phone number to deliver. If we
            need to fix an address, message us on WhatsApp before the parcel is dispatched. After dispatch we cannot promise a change.
          </p>
          <p>
            If delivery fails because the address is wrong or incomplete, or the parcel is refused or not collected, it may come back to us.
            We will contact you to ship it again, and the new shipping charge is paid by you. For cash on delivery orders, repeated refusals
            may mean we switch off cash on delivery for your future orders.
          </p>
        </>
      ),
    },
    {
      id: "damaged",
      title: "Damaged, missing or wrong parcels",
      body: (
        <>
          <p>
            <strong>Record an unboxing video.</strong> Please film the parcel being opened, in one unbroken clip, starting with the sealed
            package and the shipping label visible. This is the quickest way for us to settle a claim with the courier and to give you a
            replacement or refund.
          </p>
          <ol>
            <li>Tell us within 7 days of delivery, on WhatsApp or at {SITE.email}. Send your order number, the unboxing video and clear photos of the damage or the wrong item.</li>
            <li>We reply within 2 business days and tell you what we will do.</li>
            <li>
              If the piece arrived damaged or is not what you ordered, we will send a replacement, or refund you, as described in the{" "}
              <Link href="/policies/refund">cancellation and refund policy</Link>. We pay the shipping for the replacement.
            </li>
          </ol>
          <p>
            <strong>Marked delivered but not received?</strong> Tell us within 7 days of the delivery date shown in tracking. We will raise it
            with the courier. If the courier confirms the parcel is lost, we will reship the piece or refund you in full.
          </p>
          <p>
            <strong>Lost in transit?</strong> If a parcel has not arrived and tracking has not moved for 7 days, message us. We will trace it and
            reship or refund once the courier confirms the loss.
          </p>
        </>
      ),
    },
    {
      id: "delays",
      title: "Delays outside our control",
      body: (
        <p>
          We are not responsible for delays caused by events beyond our reasonable control, such as natural disasters, strikes, curfews,
          courier network disruptions, customs holds or government orders. We will keep you informed and, where a delay is long, offer you a
          cancellation with a full refund.
        </p>
      ),
    },
    {
      id: "contact",
      title: "Questions about shipping",
      body: (
        <p>
          Write to <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or message us on WhatsApp from the <Link href="/contact">contact page</Link>. For
          complaints, see the <Link href="/policies/grievance">grievance officer</Link> page.
        </p>
      ),
    },
  ],
};
