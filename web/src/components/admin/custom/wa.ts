import { formatDate, formatINR } from "@/lib/format";
import { balanceAmount, depositAmount } from "@/lib/api/custom";
import type { CustomRequest } from "@/lib/types";
import { firstName, waToCustomer } from "../orders/wa";
import { moneyQuote } from "./workflow";

/** WhatsApp message to the customer, worded for where the work order is right now. */
export function workOrderWhatsApp(r: CustomRequest): { href: string; label: string } {
  const hi = `Hi ${firstName(r.customerName)}! This is FuzzBall Factory.`;
  const q = moneyQuote(r);
  let text: string;
  let label = "Message on WhatsApp";
  switch (r.status) {
    case "REQUESTED":
    case "UNDER_REVIEW":
      text = `${hi} Thanks for your work order ${r.number} (${r.title}). I'm looking at it now and will send a quote soon.`;
      break;
    case "QUOTED":
      label = "Nudge on WhatsApp";
      text = `${hi} I sent a quote${q ? ` of ${formatINR(q.price)}` : ""} for ${r.number}${q ? `, valid until ${formatDate(q.validUntil)}` : ""}. Any questions before you decide?`;
      break;
    case "COUNTERED":
      text = `${hi} Thanks for your offer on ${r.number}. Let me have a look and I'll get back to you today.`;
      break;
    case "EXPIRED":
      text = `${hi} The quote for ${r.number} has expired. Still interested? I'm happy to send a fresh one.`;
      break;
    case "ACCEPTED":
    case "DEPOSIT_PENDING":
      label = "Remind on WhatsApp";
      text = `${hi} Your quote for ${r.number} is accepted. The ${q ? formatINR(depositAmount(q)) : ""} deposit is the last step before I start crocheting.`;
      break;
    case "IN_QUEUE":
    case "IN_PROGRESS":
      text = `${hi} Quick update on ${r.number}: it's coming along nicely. Photos on the way!`;
      break;
    case "AWAITING_APPROVAL":
      label = "Nudge on WhatsApp";
      text = `${hi} The final photos for ${r.number} are up on your account. Take a look and tell me if you'd like any tweaks.`;
      break;
    case "BALANCE_PENDING":
      label = "Remind on WhatsApp";
      text = `${hi} Thanks for approving ${r.number}! The ${q ? formatINR(balanceAmount(q)) : ""} balance is all that's left before I ship it.`;
      break;
    case "READY_TO_SHIP":
      text = `${hi} ${r.number} is paid up and getting packed. I'll send tracking details as soon as it's on its way.`;
      break;
    case "SHIPPED":
      text = `${hi} ${r.number} is on its way to you!`;
      break;
    case "DELIVERED":
      text = `${hi} ${r.number} should have reached you. I'd love to see it, a photo would make my day!`;
      break;
    default:
      text = `${hi} A quick note about your work order ${r.number}.`;
  }
  return { href: waToCustomer(r.customerPhone, text), label };
}
