import Image from "next/image";
import Link from "next/link";
import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";

/** The maker's own photos of the rest of the crew, each in a hand so the size reads. */
const CREW = [
  {
    src: "/maker/crew-turtle.jpg",
    name: "Turtle",
    alt: "A white crochet turtle with a pale blue shell resting on an open hand against a dark wooden door",
    tilt: -1.5,
  },
  {
    src: "/maker/crew-octopus-mushroom.jpg",
    name: "Octopus + mushroom",
    alt: "A blue crochet octopus and a pastel blue, lilac and cream crochet mushroom held together in one hand",
    tilt: 1,
  },
  {
    src: "/maker/crew-hedgehog.jpg",
    name: "Hedgehog",
    alt: "A cream crochet hedgehog with a mane of brown curls sitting on a pale wooden shelf in front of hanging macramé ropes",
    tilt: 1.5,
  },
  {
    src: "/maker/crew-brown-mushroom.jpg",
    name: "Brown mushroom",
    alt: "A crochet mushroom with a brown cap dotted with cream spots and a cream stem with two black eyes, held in a palm",
    tilt: -1,
  },
] as const;

export function TheCrew() {
  return (
    <section aria-labelledby="crew-h" className="relative overflow-x-clip pb-[clamp(3.5rem,7vw,6rem)]">
      <div className="shell">
        <div className="conveyor-indent">
          <Reveal as="h2" id="crew-h" className="font-display text-[clamp(2.5rem,5.6vw,4.5rem)]">
            The rest of the crew
          </Reveal>
          <Reveal as="p" delay={60} className="mt-5 max-w-[52ch] text-lg leading-relaxed text-brown">
            Turtles, octopuses, mushrooms and hedgehogs are still on the hook, and not in the shop yet. Want one? Ask for it as a work order.
          </Reveal>

          <ul className="mt-9 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
            {CREW.map((c, i) => (
              <li key={c.src}>
                <Reveal kind="drop" delay={i * 70}>
                  <Ticket compactHead head={[c.name]} className="transition-[translate,box-shadow] duration-300 ease-out hf:hover:-translate-y-1.5 hf:hover:shadow-lift" style={{ rotate: `${c.tilt}deg` }}>
                    <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-kraft-light">
                      <Image src={c.src} alt={c.alt} fill sizes="(min-width:1024px) 21vw, 45vw" className="object-cover" />
                    </div>
                  </Ticket>
                </Reveal>
              </li>
            ))}
          </ul>

          <Reveal delay={80} className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href="/custom">Start a work order</Link>
            </Button>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
