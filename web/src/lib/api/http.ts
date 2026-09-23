import { ApiError } from "@/lib/api/errors";

/**
 * Fetch wrapper for the real NestJS API (used when NEXT_PUBLIC_USE_MOCK=false).
 *
 * - Base URL from NEXT_PUBLIC_API_URL. Cookies (fbf_at / fbf_rt / fbf_go) ride along via `credentials: "include"`;
 *   the API allows this origin through its CORS `WEB_ORIGIN` list.
 * - JSON in and out; 204 resolves `undefined`.
 * - Errors are `{ code, message, fields? }` from the API and become `ApiError(status, message, fields, code)`.
 * - A 401 triggers ONE silent `POST /auth/refresh` (shared by concurrent requests) and a single retry.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

type Primitive = string | number | boolean | null | undefined;

export interface HttpOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON body (ignored when `form` is set). */
  body?: unknown;
  /** Multipart body (uploads). The browser sets the boundary header. */
  form?: FormData;
  /** Query string values; null/undefined/"" are dropped. */
  query?: Record<string, Primitive>;
  /** Sent as the `Idempotency-Key` header. */
  idempotencyKey?: string;
  /** Skip the 401 -> refresh -> retry step. */
  noRefresh?: boolean;
}

/** A fresh key for one money-moving attempt (POST /orders, pay-deposit, ...). Reuse it only to retry the same attempt. */
export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

/** Auth endpoints that must never trigger a refresh (a 401 there is a real answer). */
const NO_REFRESH = new Set(["/auth/login", "/auth/signup", "/auth/refresh", "/auth/logout", "/auth/forgot", "/auth/reset"]);

const NETWORK_MESSAGE = "We couldn't reach the server. Check your connection and try again.";

function url(path: string, query?: HttpOptions["query"]): string {
  const u = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return u;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${u}?${s}` : u;
}

async function send(path: string, opts: HttpOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  try {
    return await fetch(url(path, opts.query), { method: opts.method ?? "GET", headers, body, credentials: "include" });
  } catch {
    throw new ApiError(0, NETWORK_MESSAGE, undefined, "NETWORK");
  }
}

let refreshing: Promise<boolean> | null = null;

/** Rotates the session cookies. Concurrent callers share one request. Resolves false when the session is gone. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= send("/auth/refresh", { method: "POST" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Fired when a refresh fails after a 401, so the auth context can drop the signed-in user. */
export const SESSION_EXPIRED_EVENT = "fbf:session-expired";

async function toError(res: Response): Promise<ApiError> {
  let data: { code?: string; message?: string; fields?: Record<string, string> } | undefined;
  try {
    data = (await res.json()) as typeof data;
  } catch {
    /* not JSON */
  }
  const fallback = res.status >= 500 ? "Something went wrong on our side. Please try again in a moment." : "That didn't work. Please try again.";
  return new ApiError(res.status, data?.message || fallback, data?.fields, data?.code);
}

export async function http<T = void>(path: string, opts: HttpOptions = {}): Promise<T> {
  let res = await send(path, opts);
  if (res.status === 401 && !opts.noRefresh && !NO_REFRESH.has(path)) {
    if (await refreshSession()) res = await send(path, opts);
    else if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }
  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("json")) return undefined as T;
  return (await res.json()) as T;
}

/** Drops `undefined` keys (the API rejects unknown keys, and `undefined` would serialise away anyway). */
export function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Shape of the `payment` block returned by POST /orders, /orders/:n/pay and /custom/:wo/pay-*. */
export interface CheckoutPayment {
  paymentId: string;
  razorpayOrderId: string;
  keyId: string;
  amountPaise: number;
  currency: "INR";
  /** true when the API runs without Razorpay keys (dev): confirm with POST /payments/mock/:paymentId/confirm. */
  mock: boolean;
}

export interface PaymentResult {
  paymentId: string;
  status: string;
  purpose: string;
  orderNumber?: string;
  customRequestNumber?: string;
  alreadyProcessed: boolean;
}

/**
 * Settles a payment created by the API.
 *
 * - mock mode (API has no Razorpay keys, non-production): POST /payments/mock/:id/confirm { ok }.
 *   `ok:false` answers 402 and is thrown as ApiError so the modal can show it.
 * - live mode: TODO(razorpay-checkout). Open Razorpay Checkout with `payment.keyId` + `payment.razorpayOrderId`
 *   (amount `payment.amountPaise`), then POST its handler result {razorpay_order_id, razorpay_payment_id,
 *   razorpay_signature} to /payments/razorpay/verify. Until that lands, fail loudly instead of pretending.
 */
export async function settlePayment(payment: CheckoutPayment, ok: boolean): Promise<PaymentResult> {
  if (payment.mock) return http<PaymentResult>(`/payments/mock/${encodeURIComponent(payment.paymentId)}/confirm`, { method: "POST", body: { ok } });
  throw new ApiError(501, "Online payment isn't switched on in this build yet. Please choose cash on delivery or message us on WhatsApp.", undefined, "RAZORPAY_NOT_WIRED");
}
