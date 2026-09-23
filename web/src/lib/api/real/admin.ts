import { API_URL, compact, http } from "@/lib/api/http";
import type { Category, Coupon, CustomRequest, Material, Order, OrderStatus, Product, Review, StoreSettings } from "@/lib/types";
import type { CustomerRow, Dashboard, QuoteInput } from "@/lib/api/admin";

const enc = encodeURIComponent;
const post = <T>(path: string, body?: unknown) => http<T>(path, { method: "POST", body: body ?? {} });

export const dashboard = () => http<Dashboard>("/admin/dashboard");

/* products & categories */
export const listAdminProducts = (q?: string) => http<Product[]>("/admin/products", { query: { q: q?.trim() } });
export const getAdminProduct = (id: string) => http<Product>(`/admin/products/${enc(id)}`);

export function saveProduct(input: Omit<Product, "id" | "batch" | "createdAt" | "slug"> & { id?: string; slug?: string }): Promise<Product> {
  const { id, ...rest } = input;
  const body = compact({ ...rest, variants: input.variants?.map((v) => compact(v)) });
  // Create when there is no id (POST), otherwise full replace (PUT). New variants keep whatever temp id the editor made.
  return id ? http<Product>(`/admin/products/${enc(id)}`, { method: "PUT", body }) : post<Product>("/admin/products", body);
}

export async function setProductStatus(ids: string[], status: Product["status"]): Promise<void> {
  await post("/admin/products/status", { ids, status });
}

export const saveCategory = (c: Category) => http<Category>(`/admin/categories/${enc(c.slug)}`, { method: "PUT", body: c });
export const deleteCategory = (slug: string) => http(`/admin/categories/${enc(slug)}`, { method: "DELETE" });

/* orders */
export const listAdminOrders = (filter?: { status?: OrderStatus | "TO_CONFIRM" | "TO_MAKE" | "TO_PACK"; q?: string }) =>
  http<Order[]>("/admin/orders", { query: { status: filter?.status, q: filter?.q?.trim() } });
export const getAdminOrder = (number: string) => http<Order>(`/admin/orders/${enc(number)}`);
export const updateOrderStatus = (number: string, status: OrderStatus, opts?: { note?: string; courier?: string; awb?: string }) =>
  post<Order>(`/admin/orders/${enc(number)}/status`, compact({ status, note: opts?.note, courier: opts?.courier, awb: opts?.awb }));

/* work orders */
const wo = (n: string) => `/admin/custom/${enc(n)}`;
export const listAdminCustom = (status?: string) => http<CustomRequest[]>("/admin/custom", { query: { status } });
export const getAdminCustom = (number: string) => http<CustomRequest>(wo(number));
export const sendQuote = (number: string, input: QuoteInput) => post<CustomRequest>(`${wo(number)}/quote`, compact({ ...input }));
export const declineCustom = (number: string, reason: string) => post<CustomRequest>(`${wo(number)}/decline`, { reason });
export const acceptCounter = (number: string) => post<CustomRequest>(`${wo(number)}/accept-counter`);
export async function markUnderReview(number: string): Promise<void> {
  await post(`${wo(number)}/under-review`);
}
export const adminMessage = (number: string, body: string, attachments?: string[]) => post<CustomRequest>(`${wo(number)}/messages`, { body, ...(attachments?.length ? { attachments } : {}) });
export const addProgress = (number: string, note: string, photo?: string) => post<CustomRequest>(`${wo(number)}/progress`, compact({ note, photo }));
export const requestApproval = (number: string, note?: string, photo?: string) => post<CustomRequest>(`${wo(number)}/request-approval`, compact({ note, photo }));
export const markCustomShipped = (number: string, courier: string, awb: string) => post<CustomRequest>(`${wo(number)}/ship`, { courier, awb });
export const markCustomDelivered = (number: string) => post<CustomRequest>(`${wo(number)}/deliver`);

/* customers, reviews, coupons, settings */
export const listCustomers = (q?: string) => http<CustomerRow[]>("/admin/customers", { query: { q: q?.trim() } });
export const getCustomer = (id: string) => http<{ user: CustomerRow; orders: Order[]; custom: CustomRequest[] }>(`/admin/customers/${enc(id)}`);
export const listAdminReviews = (status?: Review["status"]) => http<Review[]>("/admin/reviews", { query: { status } });
export async function moderateReview(id: string, status: Review["status"], disputeReason?: string): Promise<void> {
  await http(`/admin/reviews/${enc(id)}`, { method: "PATCH", body: compact({ status, disputeReason }) });
}
export async function setReviewReply(id: string, reply: string): Promise<void> {
  await http(`/admin/reviews/${enc(id)}/reply`, { method: "PUT", body: { reply } });
}
export async function clearReviewReply(id: string): Promise<void> {
  await http(`/admin/reviews/${enc(id)}/reply`, { method: "DELETE" });
}
export const listCoupons = () => http<Coupon[]>("/admin/coupons");
export const saveCoupon = (c: Coupon) => http<Coupon>(`/admin/coupons/${enc(c.code.trim().toUpperCase())}`, { method: "PUT", body: compact({ ...c, code: c.code.trim().toUpperCase() }) });
export const deleteCoupon = (code: string) => http(`/admin/coupons/${enc(code)}`, { method: "DELETE" });
/* materials (inventory) */
export const listMaterials = () => http<Material[]>("/admin/materials");
export function saveMaterial(input: Omit<Material, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<Material> {
  const { id, sample, ...rest } = input; // `sample` is a mock-only marker; the API has no such column
  void sample;
  const body = compact(rest);
  return id ? http<Material>(`/admin/materials/${enc(id)}`, { method: "PUT", body }) : post<Material>("/admin/materials", body);
}
export async function archiveMaterial(id: string): Promise<void> {
  await http(`/admin/materials/${enc(id)}`, { method: "DELETE" });
}
export const adjustMaterialStock = (id: string, delta: number, reason?: string) => post<Material>(`/admin/materials/${enc(id)}/adjust-stock`, compact({ delta, reason }));

export const getAdminSettings = () => http<StoreSettings>("/admin/settings");
export async function updateSettings(s: StoreSettings): Promise<StoreSettings> {
  const saved = await http<StoreSettings>("/admin/settings", { method: "PUT", body: s });
  // The public GET /settings is cached for 30s by the browser: refresh that entry so this browser's storefront sees the change now.
  await fetch(`${API_URL}/settings`, { cache: "reload", credentials: "include" }).catch(() => undefined);
  return saved;
}
