import { ConveyorThread } from "@/components/home/ConveyorThread";
import { Hero } from "@/components/home/Hero";
import { YarnRoom } from "@/components/home/YarnRoom";
import { HookFloor } from "@/components/home/HookFloor";
import { TheCrew } from "@/components/home/TheCrew";
import { WhalePod } from "@/components/home/WhalePod";
import { WorkOrders } from "@/components/home/WorkOrders";
import { ShippingDock } from "@/components/home/ShippingDock";
import { MakerNote } from "@/components/home/MakerNote";
import { JsonLd, organizationLd, websiteLd } from "@/lib/json-ld";

export const metadata = { alternates: { canonical: "/" } };

export default function HomePage() {
  return (
    <>
      <JsonLd data={organizationLd()} />
      <JsonLd data={websiteLd()} />
      {/* The conveyor wrapper: the yarn thread measures everything inside it. */}
      <div className="relative">
        <ConveyorThread />
        <Hero />
        <WhalePod />
        <YarnRoom />
        <HookFloor />
        <TheCrew />
        <WorkOrders />
        <ShippingDock />
      </div>
      <MakerNote />
    </>
  );
}
