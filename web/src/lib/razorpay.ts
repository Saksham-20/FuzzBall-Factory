import { PaymentDismissedError } from "@/lib/api/errors";
import type { CheckoutPayment } from "@/lib/api/http";

/** What Razorpay Checkout hands to `handler` after a successful payment: the three values the API verifies. */
export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (response: { error?: { description?: string } }) => void): void;
}
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;
declare global {
  interface Window {
    Razorpay?: RazorpayConstructor;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<RazorpayConstructor> | null = null;

/** Loads Razorpay's script once. Rejects (and lets a later call retry) if it can't be fetched, e.g. offline or blocked. */
export function loadRazorpay(): Promise<RazorpayConstructor> {
  if (typeof window === "undefined") return Promise.reject(new Error("Razorpay can only load in the browser."));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loading ??= new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay didn't start.")));
    script.onerror = () => {
      script.remove();
      loading = null;
      reject(new Error("We couldn't reach the payment window. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return loading;
}

export interface RazorpayWindowOptions {
  /** Shown in the payment window, e.g. "Order FB-1042". */
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
}

/**
 * Opens Razorpay Checkout for a payment the API created and resolves with the values to verify.
 * Rejects with `PaymentDismissedError` if the customer closes the window (not a failure: nothing was charged).
 * A failed attempt inside the window (declined card, bank error) is handled by Razorpay itself, which lets the
 * customer retry on the same order, so this only settles on success or dismissal.
 */
export async function openRazorpayCheckout(payment: CheckoutPayment, opts: RazorpayWindowOptions): Promise<RazorpaySuccess> {
  const Razorpay = await loadRazorpay();
  return new Promise<RazorpaySuccess>((resolve, reject) => {
    const rzp = new Razorpay({
      key: payment.keyId,
      order_id: payment.razorpayOrderId,
      amount: payment.amountPaise,
      currency: payment.currency,
      name: "FuzzBall Factory",
      description: opts.description,
      prefill: opts.prefill,
      theme: { color: "#3f2619" },
      handler: (response: RazorpaySuccess) => resolve(response),
      modal: { ondismiss: () => reject(new PaymentDismissedError()), confirm_close: true },
    });
    rzp.open();
  });
}
