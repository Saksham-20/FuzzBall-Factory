"use client";

import { TicketForm } from "@/components/support/TicketForm";

/** The contact page's form: a support ticket about a question, an order, shipping or anything else. */
export function ContactForm() {
  return (
    <TicketForm
      kind="SUPPORT"
      messageHint="For an order, include the order number."
      submitLabel="Send message"
      afterSend="We aim to reply within a few days, and we acknowledge within 48 hours."
    />
  );
}
