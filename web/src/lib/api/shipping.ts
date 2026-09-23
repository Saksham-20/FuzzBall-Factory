import { SITE } from "@/lib/site";
import * as real from "@/lib/api/real/shipping";
import { db, wait } from "@/lib/mock/db";
import { addBusinessDays } from "@/lib/format";
import { zoneFor } from "@/lib/pricing";

export interface ShippingCheck {
  serviceable: boolean;
  message: string;
  transitDays: string;
  /** ISO date estimate for delivery, including the product's lead time. */
  deliverBy?: string;
  codAvailable: boolean;
}

/** Mock serviceability. The real API calls Shiprocket for India and a zone table for the rest. */
export async function checkShipping(input: { country: string; postalCode: string; leadTimeDays?: number; ready?: boolean }): Promise<ShippingCheck> {
  if (!SITE.useMock) return real.checkShipping(input);
  await wait(300);
  const s = db.get().settings;
  const lead = input.leadTimeDays ?? 2;
  if (input.country === "IN") {
    if (!/^[1-9][0-9]{5}$/.test(input.postalCode.trim())) {
      return { serviceable: false, message: "Enter a valid 6-digit pincode.", transitDays: "", codAvailable: false };
    }
    const transit = 5;
    return {
      serviceable: true,
      message: "We deliver here.",
      transitDays: "3–6 days",
      deliverBy: addBusinessDays(new Date(), lead + transit).toISOString(),
      codAvailable: !!input.ready && s.codEnabled,
    };
  }
  const zone = zoneFor(input.country, s);
  return {
    serviceable: true,
    message: `We ship to this country (${zone?.name ?? "international"}).`,
    transitDays: zone?.days ?? "",
    deliverBy: addBusinessDays(new Date(), lead + 12).toISOString(),
    codAvailable: false,
  };
}
