import Link from "next/link";
import { DataTable } from "@/components/content/Prose";
import { Ph } from "@/components/content/Placeholder";
import type { PolicyDoc } from "@/components/content/policies/types";
import { SAMPLE_SETTINGS, SITE } from "@/lib/site";

// PLACEHOLDER(legal-details): seller identity below.
// PLACEHOLDER(policy-draft): the whole text is a draft for legal review; windows and fees are the
// maker's business decisions and must be confirmed.

const dep = SAMPLE_SETTINGS.depositPct;

export const refundPolicy: PolicyDoc = {
  slug: "refund",
  title: "Cancellation and refund policy",
  shortTitle: "Cancellation and refund policy",
  description:
    "How cancellations, exchanges and refunds work at FuzzBall Factory: 7-day exchange or refund on ready-to-ship crochet, made-to-order and custom work rules, and refunds in 5 to 7 business days.",
  intro:
    "Handmade pieces are treated differently from factory stock. This page explains what can be cancelled, returned or refunded, and how to ask.",
  summary: {
    head: "The short version",
    points: [
      "Ready-to-ship pieces: exchange or refund within 7 days of delivery, if the piece is unused. Please film the unboxing.",
      "Made-to-order and personalised pieces cannot be returned, unless they arrive damaged, faulty or not as ordered.",
      `Custom work orders: the ${dep}% advance is non-refundable once we have started work on your piece.`,
      "Approved refunds reach your original payment method in 5 to 7 business days.",
    ],
  },
  sections: [
    {
      id: "kinds",
      title: "Which rules apply to my order",
      body: (
        <>
          <p>
            Every product page says whether a piece is <strong>ready to ship</strong> or <strong>made to order</strong>. That decides which
            rules apply.
          </p>
          <DataTable
            caption="Return and refund rules by kind of order"
            head={["Kind of order", "Change of mind", "Damaged, faulty or wrong item"]}
            rows={[
              ["Ready to ship", "Exchange or refund within 7 days of delivery, if unused", "Replacement or refund"],
              ["Made to order", "Not returnable", "Replacement or refund"],
              ["Personalised (name, text, chosen size or colours)", "Not returnable", "Replacement or refund"],
              ["Custom work order", "See the custom work orders section", "Replacement, repair or refund"],
            ]}
          />
          <p>
            &quot;Made to order&quot; and &quot;personalised&quot; pieces are crocheted for you after you order. We cannot resell them, which is why
            we cannot take them back for change of mind. We are always happy to fix a real problem.
          </p>
        </>
      ),
    },
    {
      id: "cancel",
      title: "Cancelling an order",
      body: (
        <>
          <ul>
            <li>
              <strong>Ready to ship:</strong> you can cancel until the parcel is handed to the courier. Message us on WhatsApp or write to{" "}
              {SITE.email} with your order number. You get a full refund.
            </li>
            <li>
              <strong>Made to order:</strong> you can cancel within 24 hours of placing the order, as long as we have not started crocheting
              it. We mark the order &quot;In production&quot; on your order page when we begin. After that it cannot be cancelled. If the piece
              is damaged or wrong, the rules below apply.
            </li>
            <li>
              <strong>Custom work orders:</strong> you can decline a quote at any time at no cost. After you accept and pay, see the custom
              work orders section.
            </li>
            <li>
              <strong>Cash on delivery:</strong> cancel before dispatch. If you refuse a cash on delivery parcel at the door without a
              reason covered by this policy, we may switch off cash on delivery for your future orders.
            </li>
          </ul>
          <p>
            We may also cancel an order, for example if a piece cannot be made, the stock is gone, the price was shown wrongly or payment
            could not be verified. In that case you get a full refund of everything you paid.
          </p>
        </>
      ),
    },
    {
      id: "ready-to-ship",
      title: "Ready-to-ship pieces: exchange or refund",
      body: (
        <>
          <p>
            You can ask for an exchange or a refund within <strong>7 days of delivery</strong>. To qualify, the piece must be:
          </p>
          <ul>
            <li>unused, unwashed and in the condition it arrived in, with any tags and packaging;</li>
            <li>reported to us within the 7 days, with your order number and an unboxing video (see below).</li>
          </ul>
          <p>
            Exchanges depend on stock. Many of our pieces are one of a kind, so if there is no suitable replacement we will refund you. For a
            change of mind, the return shipping is paid by you. If the piece is damaged, faulty or wrong, we pay for the return and the
            replacement.
          </p>
          <p>
            <strong>Not eligible:</strong> pieces that have been worn, washed, altered or damaged after delivery; pieces without the
            unboxing video where damage is claimed; and normal variation in colour and stitch (see below).
          </p>
        </>
      ),
    },
    {
      id: "made-to-order",
      title: "Made-to-order and personalised pieces",
      body: (
        <>
          <p>
            These are not returnable or refundable for change of mind, wrong size ordered, or a colour choice you no longer like. Please
            check the size in cm and the colour photos before ordering, and ask us on WhatsApp if you are unsure. We can send a photo in
            natural light on request.
          </p>
          <p>We will replace, repair or refund a made-to-order or personalised piece if it:</p>
          <ul>
            <li>arrives damaged;</li>
            <li>has a fault in the making, such as a loose seam, a fault in stitching or a missing detail; or</li>
            <li>is not what you ordered, for example the wrong colour, size or spelling of the name against your order confirmation.</li>
          </ul>
          <p>Tell us within 7 days of delivery, with your order number, the unboxing video and photos.</p>
        </>
      ),
    },
    {
      id: "custom",
      title: "Custom work orders",
      body: (
        <>
          <p>A custom work order follows a quote. Here is how money and refunds work at each step.</p>
          <ol>
            <li>
              <strong>Quote.</strong> Asking for a quote is free. A quote is valid for 7 days. You can accept it,
              counter it or decline it. Declining costs nothing.
            </li>
            <li>
              <strong>Advance.</strong> To begin, you pay a {dep}% advance. We buy materials and reserve a slot in the queue with it.
            </li>
            <li>
              <strong>Before work starts.</strong> If you cancel after paying the advance but before we mark your work order &quot;In
              progress&quot;, we refund the advance, less any payment gateway charges we cannot recover.
            </li>
            <li>
              <strong>After work starts.</strong> The advance is <strong>non-refundable</strong> once work has started, because the
              yarn is bought and the hours are spent. We show you progress photos on your work order.
            </li>
            <li>
              <strong>Approval and balance.</strong> When the piece is ready, you see photos and approve it. The balance is paid before we
              ship. Changes you ask for after approval, or outside the scope written in the quote, may be charged extra.
            </li>
            <li>
              <strong>Delivery.</strong> If the finished piece arrives damaged, or does not match the approved quote and photos, we will
              repair, replace or refund it as described above. Custom pieces are not otherwise returnable.
            </li>
          </ol>
          <p>
            If we cannot complete your work order, for any reason, we refund everything you have paid, including the advance.
          </p>
          <p>
            Custom work is never cash on delivery. We do not make licensed characters or copy another maker&apos;s design, so we will decline
            those requests before you pay anything.
          </p>
        </>
      ),
    },
    {
      id: "how-to",
      title: "How to ask for a return, exchange or refund",
      body: (
        <>
          <ol>
            <li>Message us on WhatsApp or write to {SITE.email} within 7 days of delivery.</li>
            <li>
              Send your order number, the reason, clear photos and your <strong>unboxing video</strong>: one unbroken clip, from the
              sealed parcel and shipping label to the piece coming out.
            </li>
            <li>We reply within 2 business days to approve, ask for more detail, or explain why we cannot.</li>
            <li>If we approve a return, we tell you where to send the piece, or arrange a pickup where the courier can. Keep the tracking number.</li>
            <li>We check the piece when it arrives, then send your replacement or refund.</li>
          </ol>
          <p>
            You do not need an account to ask. If you do not agree with our decision, use the <Link href="/policies/grievance">grievance
            officer</Link> page.
          </p>
        </>
      ),
    },
    {
      id: "refunds",
      title: "How and when you are refunded",
      body: (
        <>
          <ul>
            <li>
              <strong>Timing.</strong> Once a refund is approved (and, for a return, once we have received and checked the piece), we start the
              refund within 2 business days. It reaches you in <strong>5 to 7 business days</strong>. Some banks and card issuers take a few
              days more to show it.
            </li>
            <li>
              <strong>Where it goes.</strong> To the method you paid with: the same UPI account, card, or bank account. We do not refund to a
              different method.
            </li>
            <li>
              <strong>Cash on delivery orders.</strong> We refund by UPI or bank transfer to details you give us. We will never ask for a card
              number, PIN or OTP.
            </li>
            <li>
              <strong>What is refunded.</strong> The price of the piece, plus the shipping charge if the return is our fault (damaged, faulty or wrong
              item, or an order we cancel). Gift wrap and any cash on delivery fee are refunded when the whole order is refunded. Shipping
              charges on a change-of-mind return are not refunded.
            </li>
            <li>
              <strong>International orders.</strong> Refunds are made in Indian rupees to your original payment method. Currency conversion
              differences and bank fees charged by your bank are not refunded.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "variance",
      title: "Colour and stitch variation",
      body: (
        <p>
          Yarn dyes vary from batch to batch and screens show colour differently, so a piece may look a little different from its photo. Every
          piece is handmade, so tiny differences in size and stitch are normal. These are not defects and are not a reason for a refund. If you are
          unsure, ask for a photo in natural light before you order.
        </p>
      ),
    },
    {
      id: "contact",
      title: "Who to contact",
      body: (
        <p>
          <Ph>[Legal business name]</Ph>, trading as {SITE.name}. Write to <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or use the{" "}
          <Link href="/contact">contact page</Link>. Complaints are handled as described on the{" "}
          <Link href="/policies/grievance">grievance officer</Link> page.
        </p>
      ),
    },
  ],
};
