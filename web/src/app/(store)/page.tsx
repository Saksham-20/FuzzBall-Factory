import { ConveyorThread } from "@/components/home/ConveyorThread";
import { Hero } from "@/components/home/Hero";
import { WhalePod } from "@/components/home/WhalePod";
import { HookFloor } from "@/components/home/HookFloor";
import { WorkOrders } from "@/components/home/WorkOrders";
import { ShippingDock } from "@/components/home/ShippingDock";
import { JsonLd, organizationLd, websiteLd } from "@/lib/json-ld";

export const metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationLd()} />
      <JsonLd data={websiteLd()} />
      {/* The conveyor wrapper: the yarn thread measures everything inside it. Four stations: the shelf, the maker and
          how it's made, work orders, and the dock (where the thread runs out at the last way in). */}
      <div className="relative">
        <ConveyorThread />
        <Hero />
        <WhalePod />
        <HookFloor />
        <WorkOrders />
        <ShippingDock />
      </div>
    </>
  );
}
