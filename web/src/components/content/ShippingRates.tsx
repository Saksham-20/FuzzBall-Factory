"use client";

import { DataTable } from "@/components/content/Prose";
import { ErrorNote, Skeleton } from "@/components/ui/misc";
import { getSettings } from "@/lib/api/settings";
import { useApi } from "@/lib/api/useApi";
import { formatINR } from "@/lib/format";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const countryName = (code: string) => {
  try {
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
};

/**
 * PLACEHOLDER(shipping-rates): domestic and international rates come from store settings
 * (sample numbers until the maker confirms them). Reading them through the API layer means the
 * policy always matches what checkout charges, and admin edits flow through with no code change.
 */
export function ShippingRates({ part }: { part: "india" | "international" }) {
  const { data, error, loading, reload } = useApi(getSettings, "settings");

  if (error) return <ErrorNote onRetry={reload}>We couldn&apos;t load the current shipping rates. Please try again, or check the rates at checkout.</ErrorNote>;
  if (loading || !data) {
    return (
      <div aria-busy="true" className="space-y-3">
        <span className="sr-only" role="status">Loading shipping rates</span>
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-5/6" />
      </div>
    );
  }

  if (part === "india") {
    return (
      <div data-placeholder="shipping-rates" className="relative">
        <DataTable
          caption="Shipping charges within India"
          head={["Order", "Shipping charge"]}
          rows={[
            [`Below ${formatINR(data.freeShippingAbove)}`, formatINR(data.domesticShipping)],
            [`${formatINR(data.freeShippingAbove)} and above`, "Free"],
            ["Gift wrap (optional)", `${formatINR(data.giftWrapPrice)} per order`],
            ...(data.codEnabled ? [["Cash on delivery fee (ready-to-ship items only)", formatINR(data.codFee)]] : []),
          ]}
        />
      </div>
    );
  }

  return (
    <div data-placeholder="shipping-rates" className="relative">
      <DataTable
        caption="International shipping zones, charges and estimated transit times"
        head={["Zone", "Countries", "Shipping from", "Transit after dispatch"]}
        rows={data.intlZones.map((z) => [
          z.name,
          z.countries.includes("*") ? "All other countries we can ship to" : z.countries.map(countryName).join(", "),
          formatINR(z.rate),
          z.days,
        ])}
      />
    </div>
  );
}
