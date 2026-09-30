import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentDismissedError } from "@/lib/api/errors";
import type { CheckoutPayment } from "@/lib/api/http";
import { openRazorpayCheckout } from "./razorpay";

const payment: CheckoutPayment = { paymentId: "pay_1", razorpayOrderId: "order_1", keyId: "rzp_test_key", amountPaise: 57900, currency: "INR", mock: false };

type Options = Record<string, unknown> & { handler: (r: unknown) => void; modal: { ondismiss: () => void } };
let lastOptions: Options | undefined;
let opened = 0;

beforeEach(() => {
  lastOptions = undefined;
  opened = 0;
  class FakeRazorpay {
    constructor(options: Options) {
      lastOptions = options;
    }
    open() {
      opened += 1;
    }
    on() {}
  }
  // The window is already loaded: the loader must not add a script.
  vi.stubGlobal("window", { Razorpay: FakeRazorpay });
});
afterEach(() => vi.unstubAllGlobals());

describe("openRazorpayCheckout", () => {
  it("opens the window for the server-created order and resolves with what Razorpay hands back", async () => {
    const result = openRazorpayCheckout(payment, { description: "Order FB-1042", prefill: { name: "Maya", email: "maya@example.com", contact: "9811122233" } });
    await vi.waitFor(() => expect(opened).toBe(1));
    expect(lastOptions).toMatchObject({
      key: "rzp_test_key",
      order_id: "order_1",
      amount: 57900,
      currency: "INR",
      name: "FuzzBall Factory",
      description: "Order FB-1042",
      prefill: { name: "Maya", email: "maya@example.com", contact: "9811122233" },
    });
    const paid = { razorpay_order_id: "order_1", razorpay_payment_id: "pay_abc", razorpay_signature: "sig" };
    lastOptions!.handler(paid);
    await expect(result).resolves.toEqual(paid);
  });

  it("rejects with PaymentDismissedError when the customer closes the window", async () => {
    const result = openRazorpayCheckout(payment, { description: "Order FB-1042" });
    await vi.waitFor(() => expect(opened).toBe(1));
    lastOptions!.modal.ondismiss();
    await expect(result).rejects.toBeInstanceOf(PaymentDismissedError);
    await expect(result).rejects.toThrow(/Nothing was charged/);
  });

  it("asks before closing a half-finished payment", async () => {
    const result = openRazorpayCheckout(payment, { description: "x" });
    await vi.waitFor(() => expect(opened).toBe(1));
    expect(lastOptions!.modal).toMatchObject({ confirm_close: true });
    lastOptions!.modal.ondismiss();
    await expect(result).rejects.toBeInstanceOf(PaymentDismissedError);
  });
});
