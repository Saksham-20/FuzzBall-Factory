import { ConveyorThread } from "@/components/home/ConveyorThread";
import { Hero } from "@/components/home/Hero";
import { YarnRoom } from "@/components/home/YarnRoom";
import { HookFloor } from "@/components/home/HookFloor";
import { Shelf } from "@/components/home/Shelf";
import { WorkOrders } from "@/components/home/WorkOrders";
import { ShippingDock } from "@/components/home/ShippingDock";
import { MakerNote } from "@/components/home/MakerNote";

export default function HomePage() {
  return (
    <>
      {/* The conveyor wrapper: the yarn thread measures everything inside it. */}
      <div className="relative">
        <ConveyorThread />
        <Hero />
        <YarnRoom />
        <HookFloor />
        <Shelf />
        <WorkOrders />
        <ShippingDock />
      </div>
      <MakerNote />
    </>
  );
}
