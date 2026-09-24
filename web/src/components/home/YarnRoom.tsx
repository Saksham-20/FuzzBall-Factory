import Image from "next/image";
import { Ticket } from "@/components/brand/Ticket";
import { YarnBall } from "@/components/brand/YarnBall";
import { Reveal } from "@/components/ui/Reveal";
import { StationSection } from "@/components/home/StationSection";
import { waRealLight } from "@/lib/whatsapp";

/** PLACEHOLDER(copy-fibers): confirm the yarns the maker actually uses. */
const FIBERS = [
  { name: "Milk cotton", feel: "Soft, matte and gentle on skin. Our pick for plushies and baby pieces.", hex: "#f1e4d3" },
  { name: "Cotton", feel: "Sturdy and breathable, and it holds its shape. Bags, coasters, tops.", hex: "#d4ae80" },
  // Butter, not rose: rose is kept for the thread and the active state.
  { name: "Acrylic", feel: "Light, bright and easy to wash. Charms, flowers, small things.", hex: "#f4cd52" },
  { name: "Chenille", feel: "Velvety and squishy. For the big cuddly ones.", hex: "#8a6249" },
  { name: "Wool blend", feel: "Warm and springy. Beanies and winter pieces.", hex: "#2f3f66" },
] as const;

export function YarnRoom() {
  return (
    <StationSection id="yarn-room" n="01" name="Yarn Room">
      <div className="grid items-start gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <Reveal kind="drop" className="mx-auto w-full max-w-[420px] lg:top-28 lg:mx-0 lg-tall:sticky">
          <Ticket
            data-placeholder="sample-photo"
            head={["Yarn Room", "Stock check"]}
            className="-rotate-2"
          >
            <div className="relative aspect-[6/5] overflow-hidden rounded-[10px]">
              <Image
                src="/samples/yarn-assorted.jpg"
                alt="Balls of yarn in assorted colours"
                fill
                sizes="(min-width:1024px) 34vw, 90vw"
                className="object-cover"
              />
            </div>
            <p className="px-1 pt-3 pb-1 text-sm text-brown">Sample photo. Real yarn shots coming.</p>
          </Ticket>
        </Reveal>

        <div>
          <Reveal as="h2" className="font-display text-[clamp(2.5rem,5.6vw,4.5rem)]">
            Every piece starts as a ball of yarn
          </Reveal>
          <Reveal as="p" delay={60} className="mt-5 max-w-[56ch] text-lg leading-relaxed text-brown">
            The fiber decides how a piece feels, so we choose it for each item and list it on every product page.
          </Reveal>

          <dl data-placeholder="copy-fibers" className="relative mt-8 divide-y divide-line border-y border-line">
            {FIBERS.map((f, i) => (
              <Reveal key={f.name} delay={i * 50} className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 py-4 sm:grid-cols-[11rem_1fr]">
                <dt className="flex items-center gap-3 font-bold">
                  <YarnBall color={f.hex} small spin={false} className="size-8 shrink-0" />
                  {f.name}
                </dt>
                <dd className="col-span-2 text-brown sm:col-span-1">{f.feel}</dd>
              </Reveal>
            ))}
          </dl>

          <Reveal as="p" delay={100} className="mt-6 max-w-[58ch] leading-relaxed text-brown">
            Colours can look a little different from screen to screen, and from one yarn batch to the next. Want to see the
            real thing first?{" "}
            <a href={waRealLight()} target="_blank" rel="noopener noreferrer" className="font-semibold text-cocoa underline">
              Ask for a photo in natural light
            </a>
            .
          </Reveal>
        </div>
      </div>
    </StationSection>
  );
}
