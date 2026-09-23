import Link from "next/link";
import type { ReactNode } from "react";
import { formatINR } from "@/lib/format";
import { SAMPLE_SETTINGS, SITE } from "@/lib/site";
import { waRealLight } from "@/lib/whatsapp";

// PLACEHOLDER(shipping-rates): COD cap and fee, free-shipping threshold and gift wrap price below
// are the sample values from SAMPLE_SETTINGS; answers that quote them are NOT in the JSON-LD.
// PLACEHOLDER(copy-leadtimes): the lead-time answers are generic; real times are on each product.

export interface FaqItem {
  id: string;
  q: string;
  a: ReactNode;
  /**
   * Plain-text answer for FAQPage structured data. Only set it when the answer is true and static:
   * never for answers that quote sample prices, limits or lead times.
   */
  ld?: string;
}

export interface FaqGroup {
  id: string;
  title: string;
  items: FaqItem[];
}

const S = SAMPLE_SETTINGS;

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "lead-times",
    title: "Lead times",
    items: [
      {
        id: "mto",
        q: "What does “made to order” mean?",
        a: <p>The piece is crocheted after you order it, so it takes longer than something already on the shelf. The lead time is shown on the product page, in your cart and at checkout, with an estimated dispatch date.</p>,
        ld: "Made-to-order means the piece is crocheted after you order it, so it takes longer than something already on the shelf. The lead time is shown on the product page, in the cart and at checkout, with an estimated dispatch date.",
      },
      {
        id: "how-long",
        q: "How long until my order ships?",
        a: (
          <p>
            Ready-to-ship pieces leave in about 1 to 2 business days. Made-to-order pieces usually leave in 4 to 10 business days, and the exact number is on
            each product. Delivery takes extra time after that. See the <Link href="/policies/shipping">shipping policy</Link>.
          </p>
        ),
      },
      {
        id: "rush",
        q: "I need it by a certain date. Can you do that?",
        a: (
          <p>
            Tell us the date on WhatsApp before you order, and we will say honestly whether it is possible. For a custom work order, add the needed-by date
            to your request.
          </p>
        ),
      },
    ],
  },
  {
    id: "custom-orders",
    title: "Custom orders",
    items: [
      {
        id: "custom-how",
        q: "How does a custom work order work?",
        a: (
          <p>
            You send a request with your idea, references, colours, size and budget. We reply with a quote. You can accept it, counter it (up to two times) or
            decline it. When you accept, you pay a {S.depositPct}% advance and we start. You see progress photos, approve the finished piece, pay the balance, and we ship.
            Start one on the <Link href="/custom">work orders</Link> page.
          </p>
        ),
      },
      {
        id: "quote-valid",
        q: "How long is a quote valid, and can I negotiate?",
        a: <p>A quote is valid for 7 days. You can counter it up to two times with a price you have in mind. We will accept, adjust or explain what would change the price.</p>,
        ld: "A quote is valid for 7 days. You can counter it up to two times with a price you have in mind, and the maker will accept, adjust or explain what would change the price.",
      },
      {
        id: "deposit",
        q: "Why is there an advance, and is it refundable?",
        a: (
          <p>
            The {S.depositPct}% advance pays for yarn and holds your place in the queue. If you cancel before we start work, we refund it less any payment gateway
            charges we cannot recover. Once work has started, it is non-refundable. If we cannot make your piece, you get everything back.
          </p>
        ),
      },
      {
        id: "customise",
        q: "Can I change an existing product?",
        a: <p>Yes. Use “Customize this” on a product page to ask for different colours, sizes, a name or other details. We will send a quote for your version.</p>,
        ld: "Yes. Use 'Customize this' on a product page to ask for different colours, sizes, a name or other details, and the maker will send a quote for your version.",
      },
      {
        id: "changes",
        q: "Can I ask for changes after I approve?",
        a: <p>Your quote states how many revisions are included. Changes after approval or outside what the quote covers may be charged.</p>,
      },
    ],
  },
  {
    id: "payments",
    title: "Payments",
    items: [
      {
        id: "pay-how",
        q: "How can I pay?",
        a: <p>Online with UPI, cards or netbanking through Razorpay, or cash on delivery for eligible ready-to-ship items in India. Custom work orders are paid online in two parts: the advance, then the balance before shipping.</p>,
      },
      {
        id: "pay-safe",
        q: "Is it safe to pay?",
        a: <p>Payments happen on Razorpay&apos;s secure page. We never see or store your full card number, UPI PIN or OTP.</p>,
        ld: "Payments are processed on Razorpay's secure payment page. The shop never sees or stores your full card number, UPI PIN or OTP.",
      },
      {
        id: "gift",
        q: "Do you offer gift wrap?",
        a: <p>Yes. Add gift wrap and a note at checkout for {formatINR(S.giftWrapPrice)}, and we leave the price off the packing slip.</p>,
      },
    ],
  },
  {
    id: "cod",
    title: "Cash on delivery",
    items: [
      {
        id: "cod-rules",
        q: "When can I pay on delivery?",
        a: (
          <p>
            Cash on delivery is for <strong>ready-to-ship pieces in India</strong>, for orders up to {formatINR(S.codCap)}, with a fee of {formatINR(S.codFee)}.
            We may confirm the order with you on WhatsApp before we dispatch it.
          </p>
        ),
      },
      {
        id: "cod-not",
        q: "When is cash on delivery not available?",
        a: <p>It is never available for made-to-order pieces, personalised pieces, custom work orders or international orders. Those are paid online, because we start making them for you.</p>,
        ld: "Cash on delivery is never available for made-to-order pieces, personalised pieces, custom work orders or international orders. Those are paid online because the maker starts making them for you.",
      },
    ],
  },
  {
    id: "international",
    title: "International shipping",
    items: [
      {
        id: "intl-ship",
        q: "Do you ship outside India?",
        a: (
          <p>
            Yes, to selected countries. Prices are in Indian rupees and the shipping charge depends on the zone. Rates and estimated delivery times are in the{" "}
            <Link href="/policies/shipping#international">shipping policy</Link>.
          </p>
        ),
      },
      {
        id: "intl-duty",
        q: "Who pays customs duties?",
        a: <p>You do. Duties, import taxes and courier handling fees set by your country are not included in our price, and are collected on delivery by the courier or customs.</p>,
        ld: "The buyer pays customs duties, import taxes and courier handling fees set by the destination country. They are not included in the price and are collected by the courier or customs.",
      },
      {
        id: "intl-cod",
        q: "Can I pay on delivery abroad?",
        a: <p>No. International orders are prepaid.</p>,
        ld: "No. International orders are prepaid only.",
      },
    ],
  },
  {
    id: "returns",
    title: "Returns and refunds",
    items: [
      {
        id: "ret-rts",
        q: "Can I return a ready-to-ship piece?",
        a: <p>Yes. Within 7 days of delivery you can ask for an exchange or a refund, if the piece is unused. Please film the unboxing. Details are in the <Link href="/policies/refund">refund policy</Link>.</p>,
        ld: "Yes. Within 7 days of delivery you can ask for an exchange or a refund on a ready-to-ship piece if it is unused. An unboxing video is needed for damage claims.",
      },
      {
        id: "ret-mto",
        q: "Can I return a made-to-order or personalised piece?",
        a: <p>Not for change of mind, because it was made for you. If it arrives damaged, faulty or not as ordered, tell us within 7 days and we will replace, repair or refund it.</p>,
        ld: "Made-to-order and personalised pieces cannot be returned for change of mind because they are made for you. If one arrives damaged, faulty or not as ordered, the maker will replace, repair or refund it when reported within 7 days.",
      },
      {
        id: "ret-damaged",
        q: "My parcel arrived damaged. What do I do?",
        a: <p>Send us your order number, photos and the unboxing video within 7 days, on WhatsApp or at {SITE.email}. We will arrange a replacement or refund.</p>,
      },
      {
        id: "ret-when",
        q: "When will I get my refund?",
        a: <p>Approved refunds go back to your original payment method and reach you in 5 to 7 business days. Some banks take a few days more to show it.</p>,
        ld: "Approved refunds go back to the original payment method and reach you in 5 to 7 business days. Some banks take a few days more to show it.",
      },
    ],
  },
  {
    id: "care",
    title: "Care",
    items: [
      {
        id: "care-wash",
        q: "How do I wash a crochet piece?",
        a: <p>It depends on the fibre. As a rule: cool water, mild soap, no wringing, and dry flat in the shade. The <Link href="/care-guide">care guide</Link> lists each fibre, and the product page has its own care note.</p>,
        ld: "It depends on the fibre. As a rule, wash in cool water with mild soap, do not wring, and dry flat in the shade. Follow the care note on the product page.",
      },
      {
        id: "care-colour",
        q: "Will the colour match the photo?",
        a: (
          <p>
            Very close, but not always exact. Yarn dyes vary between batches and screens differ. Ask for a{" "}
            <a href={waRealLight()} target="_blank" rel="noopener noreferrer">
              photo in natural light
            </a>{" "}
            before you order if the colour matters to you.
          </p>
        ),
        ld: "Very close, but not always exact. Yarn dyes vary between batches and screens differ. You can ask for a photo in natural light before ordering.",
      },
      {
        id: "care-safe",
        q: "Are the plushies safe for babies?",
        a: <p>Read the product page. Plushies and small parts are not toys for children under 3 unless the page says the piece is made for that age. Always supervise young children.</p>,
        ld: "Plushies and small parts are not toys for children under 3 unless the product page says the piece is made for that age. Young children should always be supervised.",
      },
    ],
  },
  {
    id: "characters",
    title: "Licensed characters",
    items: [
      {
        id: "char-make",
        q: "Can you make a Disney, Pokémon or other cartoon character?",
        a: <p>No. We make original designs only. Licensed and copyrighted characters belong to their owners, so we do not make or sell them. Tell us the colours, mood and features you love, and we will suggest an original design.</p>,
        ld: "No. FuzzBall Factory makes original designs only. Licensed and copyrighted characters belong to their owners, so they are not made or sold. The maker can suggest an original design based on the colours, mood and features you like.",
      },
    ],
  },
];

/** FAQPage structured data from the answers that carry `ld` text. */
export function faqJsonLd() {
  const mainEntity = FAQ_GROUPS.flatMap((g) => g.items)
    .filter((i) => i.ld)
    .map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.ld },
    }));
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity };
}
