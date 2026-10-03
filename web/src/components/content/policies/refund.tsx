import Link from "next/link";
import { DataTable } from "@/components/content/Prose";
import { LegalValue } from "@/components/content/Placeholder";
import type { PolicyDoc } from "@/components/content/policies/types";
import { LEGAL } from "@/lib/legal";
import { POLICY } from "@/lib/policy-constants";
import { SAMPLE_SETTINGS, SITE } from "@/lib/site";

// PLACEHOLDER(legal-details): seller identity below.
// PLACEHOLDER(policy-draft): the whole text is a draft for legal review; windows and fees are the
// maker's business decisions and must be confirmed.

const dep = SAMPLE_SETTINGS.depositPct;
const { returnWindowDays: ret, defectWindowDays: defect, euWithdrawalDays: eu } = POLICY;

export const refundPolicy: PolicyDoc = {
  slug: "refund",
  title: "Cancellation and refund policy",
  shortTitle: "Cancellation and refund policy",
  description:
    `How cancellations, exchanges and refunds work at FuzzBall Factory: ${ret}-day exchange or refund on ready-to-ship crochet, made-to-order and custom work rules, damaged or faulty items, and refunds in ${POLICY.refundArrival}.`,
  intro:
    "Handmade pieces are treated differently from factory stock. This page explains what can be cancelled, returned or refunded, and how to ask.",
  summary: {
    head: "The short version",
    points: [
      `Ready-to-ship pieces: exchange or refund within ${ret} days of delivery, if the piece is unused.`,
      "Made-to-order and personalised pieces cannot be returned for change of mind. If one arrives damaged, faulty or not as ordered, we repair, replace or refund it.",
      `Damaged in transit or the wrong item: tell us within ${ret} days. A fault in the making: within ${defect} days. Your legal rights are not affected.`,
      `Custom work orders: cancel before work starts and you pay nothing. After that we keep only the cost of the materials bought and the work done, shown to you in writing.`,
      `Approved refunds reach your original payment method in ${POLICY.refundArrival}.`,
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
              ["Ready to ship", `Exchange or refund within ${ret} days of delivery, if unused`, "Replacement or refund"],
              ["Made to order", "Not returnable", "Replacement or refund"],
              ["Personalised (name, text, chosen size or colours)", "Not returnable", "Replacement or refund"],
              ["Custom work order", "See the custom work orders section", "Repair, replacement or refund"],
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
              <strong>Made to order:</strong> cancel any time before we start crocheting it, and you pay nothing. We mark the order
              &quot;In production&quot; on your order page when we begin. After that, you can still cancel: we keep only the cost of the
              materials bought and the work done for your piece, shown to you in writing, and refund the rest. If the piece is damaged or
              wrong, the rules below apply.
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
            You can ask for an exchange or a refund within <strong>{ret} days of delivery</strong>. To qualify, the piece must be:
          </p>
          <ul>
            <li>unused, unwashed and in the condition it arrived in, with any tags and packaging;</li>
            <li>reported to us within the {ret} days, with your order number.</li>
          </ul>
          <p>
            Exchanges depend on stock. Many of our pieces are one of a kind, so if there is no suitable replacement we will refund you. For a
            change of mind, the return shipping is paid by you. If the piece is damaged, faulty or wrong, we pay for the return and the
            replacement.
          </p>
          <p>
            <strong>Not eligible for change of mind:</strong> pieces that have been worn, washed, altered or damaged after delivery, and normal
            variation in colour and stitch (see below).
          </p>
          <p>
            An unboxing video, filmed in one unbroken clip from the sealed parcel, helps us settle a claim with the courier. If you do not have
            one, send photos and we will still review your claim.
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
          <p>We will repair, replace or refund a made-to-order or personalised piece if it:</p>
          <ul>
            <li>arrives damaged;</li>
            <li>has a fault in the making, such as a loose seam, a fault in stitching or a missing detail; or</li>
            <li>is not what you ordered, for example the wrong colour, size or spelling of the name against your order confirmation.</li>
          </ul>
          <p>
            Tell us within {ret} days of delivery if it arrived damaged or is not what you ordered, and within {defect} days if there is a fault in
            the making. Send your order number and photos. Your rights under the Consumer Protection Act, 2019 are not limited by these windows.
          </p>
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
              <strong>After work starts.</strong> If you cancel, we keep only the cost of the materials bought and the work done for your
              order, itemised and shown to you in writing, and refund the rest of what you have paid. We show you progress photos on your work
              order, so you can see what has been done.
            </li>
            <li>
              <strong>Approval and balance.</strong> When the piece is ready, you see photos and approve it. The balance is paid before we
              ship, within {POLICY.balanceDueDays} days of our notice. After that we may cancel the order, and the same cost basis applies.
              Changes you ask for after approval, or outside the scope written in the quote, may be charged extra, and we tell you the price first.
            </li>
            <li>
              <strong>Delivery.</strong> If the finished piece arrives damaged, or does not match the approved quote and photos, we will
              repair or replace it, or refund you if that is not possible in a reasonable time. Custom pieces are not otherwise returnable
              for change of mind.
            </li>
          </ol>
          <p>
            If we cannot complete your work order, or we cancel it for a reason that is not yours, we refund everything you have paid,
            including the advance.
          </p>
          <p>
            Custom work is never cash on delivery.
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
            <li>Message us on WhatsApp or write to {SITE.email} within the windows above ({ret} days of delivery for transit damage, a wrong item or an exchange; {defect} days for a fault in the making).</li>
            <li>
              Send your order number, the reason and clear photos. An <strong>unboxing video</strong>, if you filmed one, helps but is not
              required.
            </li>
            <li>We reply within {POLICY.refundStartBusinessDays} business days to approve, ask for more detail, or explain why we cannot.</li>
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
              refund within {POLICY.refundStartBusinessDays} business days. It reaches you in <strong>{POLICY.refundArrival}</strong>. Some banks and card issuers take a few
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
      id: "eu-uk",
      title: "Buyers in the EU and UK",
      body: (
        <>
          <p>
            If you live in the EU or UK, you can withdraw from a purchase of non-personalised items within {eu} days of receiving them (return
            shipping is paid by you). Items made to your specification or clearly personalised are excluded (Directive 2011/83/EU, Art 16(c)). To
            withdraw, write to {SITE.email} with your order number.
          </p>
          <p>Import duties and taxes charged by your country are not refunded by us, and your mandatory local consumer rights still apply.</p>
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
          <LegalValue value={LEGAL.legalName} label="Legal business name" />, trading as {SITE.name}. Write to <a href={`mailto:${SITE.email}`}>{SITE.email}</a> or use the{" "}
          <Link href="/contact">contact page</Link>. Complaints are handled as described on the{" "}
          <Link href="/policies/grievance">grievance officer</Link> page.
        </p>
      ),
    },
  ],
};
