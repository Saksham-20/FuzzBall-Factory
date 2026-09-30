/** Thrown by both the mock layer and the real HTTP client. `fields` maps input paths to messages. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
    /** Machine code from the real API (e.g. OUT_OF_STOCK); absent for mock errors. */
    public code?: string,
  ) {
    super(message);
  }
}

/** The customer closed the Razorpay window without paying. Not a failure: the order or work order is still waiting for them. */
export class PaymentDismissedError extends Error {
  constructor() {
    super("You closed the payment window before paying. Nothing was charged.");
    this.name = "PaymentDismissedError";
  }
}

/**
 * Razorpay reported a payment but we couldn't confirm it in time (the verify call or the wait for the webhook ran out).
 * The money may well have moved: never tell the customer it failed. Say it is being confirmed.
 */
export class PaymentUnconfirmedError extends Error {
  constructor() {
    super("We're still confirming your payment with the bank. You'll get an email as soon as it's done. Please don't pay again.");
    this.name = "PaymentUnconfirmedError";
  }
}
