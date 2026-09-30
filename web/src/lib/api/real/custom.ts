import { ApiError, PaymentUnconfirmedError } from "@/lib/api/errors";
import { http, newIdempotencyKey, settlePayment, type CheckoutPayment } from "@/lib/api/http";
import { waitUntil } from "@/lib/wait-until";
import type { CustomRequest } from "@/lib/types";
import type { CreateCustomInput } from "@/lib/api/custom";

const wo = (n: string) => `/custom/${encodeURIComponent(n)}`;
const post = <T = CustomRequest>(path: string, body?: unknown, idempotencyKey?: string) => http<T>(path, { method: "POST", body: body ?? {}, idempotencyKey });

/** `references` must already be uploaded image URLs (ImageUploader does this through POST /uploads). */
export const createRequest = (input: CreateCustomInput) => post("/custom", { ...input, termsAccepted: true }, newIdempotencyKey());
export const listMine = () => http<CustomRequest[]>("/custom");
export const getMine = (number: string) => http<CustomRequest>(wo(number));
export const addMessage = (number: string, body: string, attachments?: string[]) => post(`${wo(number)}/messages`, { body, ...(attachments?.length ? { attachments } : {}) });
export const acceptQuote = (number: string, quoteId: string) => post(`${wo(number)}/quotes/${encodeURIComponent(quoteId)}/accept`, {}, newIdempotencyKey());
export const counterQuote = (number: string, quoteId: string, amount: number, note: string) => post(`${wo(number)}/quotes/${encodeURIComponent(quoteId)}/counter`, { amount, ...(note.trim() ? { note } : {}) });
export const declineQuote = (number: string, quoteId: string, reason?: string) => post(`${wo(number)}/quotes/${encodeURIComponent(quoteId)}/decline`, reason ? { reason } : {});
export const approveFinal = (number: string) => post(`${wo(number)}/approve`);
export const requestChange = (number: string, note: string) => post<CustomRequest & { extraCharge: boolean }>(`${wo(number)}/request-change`, { note });

/** The API answers with a CheckoutPayment; settle it (mock mode) and re-read the work order. */
async function pay(number: string, step: "pay-deposit" | "pay-balance"): Promise<CustomRequest> {
  // The API hands back the same open Razorpay order on a repeat call, so tapping pay again resumes instead of stacking.
  const payment = await post<CheckoutPayment>(`${wo(number)}/${step}`, {}, newIdempotencyKey());
  // Live: Razorpay's window (PaymentDismissedError if closed). Simulated payment mode (staging): confirms straight away.
  try {
    await settlePayment(payment, true, { description: `${step === "pay-deposit" ? "Deposit" : "Balance"} for ${number}` });
  } catch (e) {
    // The verify call went unanswered (network, 5xx): the payment may still have landed (the webhook confirms it too), so
    // watch the work order move on for a while instead of telling the customer it failed.
    if (!(e instanceof ApiError && (e.status === 0 || e.status >= 500))) throw e;
    const waiting = step === "pay-deposit" ? "DEPOSIT_PENDING" : "BALANCE_PENDING";
    const moved = await waitUntil(async () => (await getMine(number)).status !== waiting, { timeoutMs: 30_000, everyMs: 2_500 });
    if (!moved) throw new PaymentUnconfirmedError();
  }
  return getMine(number);
}
export const payDeposit = (number: string) => pay(number, "pay-deposit");
export const payBalance = (number: string) => pay(number, "pay-balance");
