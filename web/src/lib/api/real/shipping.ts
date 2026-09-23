import { http } from "@/lib/api/http";
import type { ShippingCheck } from "@/lib/api/shipping";

export const checkShipping = (input: { country: string; postalCode: string; leadTimeDays?: number; ready?: boolean }) =>
  http<ShippingCheck>("/shipping/check", { query: { country: input.country, postalCode: input.postalCode.trim(), leadTimeDays: input.leadTimeDays, ready: input.ready === undefined ? undefined : String(input.ready) } });
