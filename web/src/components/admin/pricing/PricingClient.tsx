"use client";

import { AdminPage } from "@/components/admin/ui";
import { PriceCalculator } from "@/components/admin/pricing/PriceCalculator";

export function PricingClient() {
  return (
    <AdminPage title="Price calculator">
      <p className="max-w-[62ch] text-brown">
        Work out what a piece is really costing you, line by line, then a price that covers it. The price itself
        isn&apos;t saved from here — to set a product&apos;s live price, open the calculator from its editing page
        instead, where a &quot;Use this price&quot; button fills it in for you. If you pick a material and log it as
        used, though, that does reduce what&apos;s on hand in your inventory.
      </p>
      <div className="max-w-xl">
        <PriceCalculator />
      </div>
    </AdminPage>
  );
}
