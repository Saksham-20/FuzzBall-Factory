import { ApiError } from "@/lib/api/errors";
import { openRazorpayCheckout, type RazorpayWindowOptions } from "@/lib/razorpay";

/**
 * Fetch wrapper for the real NestJS API (used when NEXT_PUBLIC_USE_MOCK=false).
 *
 * - Base URL from NEXT_PUBLIC_API_URL. Cookies (fbf_at / fbf_rt / fbf_go) ride along via `credentials: "include"`;
 *   the API allows this origin through its CORS `WEB_ORIGIN` list.
 * - JSON in and out; 204 resolves `undefined`.
 * - Errors are `{ code, message, fields? }` from the API and become `ApiError(status, message, fields, code)`.
 * - A 401 triggers ONE silent `POST /auth/refresh` (shared by concurrent requests) and a single retry.
 * - Every request times out (15s, 60s for uploads) so a hung API becomes an error state instead of a spinner.
 * - A GET that fails to connect or gets a 502/503/504 is retried once after a short random pause; writes never are
 *   (a repeated payment or order needs the caller's own idempotency key).
 * - Concurrent identical GETs share one request (the header, shelf and page all ask for the categories).
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
const NO_REFRESH = new Set(["/auth/login", "/auth/signup", "/auth/refresh", "/auth/logout", "/auth/forgot", "/auth/reset", "/auth/verify-email"]);

const NETWORK_MESSAGE = "We couldn't reach the server. Check your connection and try again.";
const TIMEOUT_MESSAGE = "The server is taking too long to answer. Please try again in a moment.";

const TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;
/** Gateway answers that mean "the app was restarting or busy", safe to repeat for a read. */
const RETRY_STATUSES = new Set([502, 503, 504]);

function url(path: string, query?: HttpOptions["query"]): string {
  const u = `${API_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return u;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${u}?${s}` : u;
}

async function attempt(path: string, opts: HttpOptions, headers: Record<string, string>, body: BodyInit | undefined): Promise<Response> {
  try {
    return await fetch(url(path, opts.query), {
      method: opts.method ?? "GET",
      headers,
      body,
      credentials: "include",
      signal: AbortSignal.timeout(opts.form ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") throw new ApiError(0, TIMEOUT_MESSAGE, undefined, "TIMEOUT");
    throw new ApiError(0, NETWORK_MESSAGE, undefined, "NETWORK");
  }
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

  const readOnly = (opts.method ?? "GET") === "GET";
  let res: Response | undefined;
  try {
    res = await attempt(path, opts, headers, body);
  } catch (e) {
    // A timeout is not retried: the visitor already waited the full time.
    if (!readOnly || !(e instanceof ApiError) || e.code !== "NETWORK") throw e;
  }
  if (readOnly && (!res || RETRY_STATUSES.has(res.status))) {
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300));
    res = await attempt(path, opts, headers, body);
  }
  return res as Response;
}

let refreshing: Promise<boolean> | null = null;

/**
 * Another tab refreshed at the same moment (409): it won, and the browser already holds its newer cookies, so wait a
 * beat and go again; if it is still busy the session is fine, so let the caller's retry find out.
 */
async function refreshOnce(): Promise<boolean> {
  let res = await send("/auth/refresh", { method: "POST" });
  if (res.status === 409) {
    await new Promise((r) => setTimeout(r, 250));
    res = await send("/auth/refresh", { method: "POST" });
    return res.ok || res.status === 409;
  }
  return res.ok;
}

/** Rotates the session cookies. Concurrent callers share one request. Resolves false when the session is gone. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= refreshOnce()
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

async function request<T>(path: string, opts: HttpOptions): Promise<T> {
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

const inflight = new Map<string, Promise<unknown>>();

export function http<T = void>(path: string, opts: HttpOptions = {}): Promise<T> {
  if ((opts.method ?? "GET") !== "GET") {
    // A write makes anything already in flight stale: later reads must start their own request.
    inflight.clear();
    return request<T>(path, opts).finally(() => inflight.clear());
  }
  const key = url(path, opts.query);
  let shared = inflight.get(key) as Promise<T> | undefined;
  if (!shared) {
    shared = request<T>(path, opts).finally(() => {
      if (inflight.get(key) === shared) inflight.delete(key);
    });
    inflight.set(key, shared);
  }
  // Each caller gets its own copy, so one component editing its data cannot change another's.
  return shared.then((value) => (value === undefined ? value : structuredClone(value)));
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
 * - mock payment mode (the API runs PAYMENTS_MODE=mock): POST /payments/mock/:id/confirm { ok }.
 *   `ok:false` answers 402 and is thrown as ApiError so the modal can show it.
 * - live mode: opens Razorpay Checkout, then POSTs the handler result to /payments/razorpay/verify (HMAC-checked by the API).
 *   Throws `PaymentDismissedError` if the customer closes the window. If the verify call itself can't be answered (network,
 *   5xx) the payment may still have gone through, so that surfaces as `PaymentUnconfirmedError` after the caller has had
 *   a chance to look the order up: see `confirmPayment` in real/orders.ts. A 4xx (bad signature) stays an ApiError.
 */
export async function settlePayment(payment: CheckoutPayment, ok: boolean, opts?: RazorpayWindowOptions): Promise<PaymentResult> {
  if (payment.mock) return http<PaymentResult>(`/payments/mock/${encodeURIComponent(payment.paymentId)}/confirm`, { method: "POST", body: { ok } });
  const paid = await openRazorpayCheckout(payment, opts ?? { description: "FuzzBall Factory" });
  return http<PaymentResult>("/payments/razorpay/verify", { method: "POST", body: paid, idempotencyKey: `verify-${paid.razorpay_payment_id}` });
}
