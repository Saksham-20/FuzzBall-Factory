import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Ticket } from "@/components/brand/Ticket";
import { Reveal } from "@/components/ui/Reveal";
import type { IdeaKey } from "@/lib/custom-ideas";

/** The maker's own photos of the rest of the crew, each in a hand so the size reads. Each opens a work order for one like it. */
const CREW: { src: string; name: string; alt: string; tilt: number; idea: IdeaKey }[] = [
  {
    idea: "turtle",
    src: "/maker/crew-turtle.jpg",
    name: "Turtle",
    alt: "A white crochet turtle with a pale blue shell resting on an open hand against a dark wooden door",
    tilt: -1.5,
  },
  {
    idea: "octopus",
    src: "/maker/crew-octopus-mushroom.jpg",
    name: "Octopus",
    alt: "A blue crochet octopus and a pastel blue, lilac and cream crochet mushroom held together in one hand",
    tilt: 1,
  },
  {
    idea: "hedgehog",
    src: "/maker/crew-hedgehog.jpg",
    name: "Hedgehog",
    alt: "A cream crochet hedgehog with a mane of brown curls sitting on a pale wooden shelf in front of hanging macramé ropes",
    tilt: 1.5,
  },
  {
    idea: "mushroom",
    src: "/maker/crew-brown-mushroom.jpg",
    name: "Mushroom",
    alt: "A crochet mushroom with a brown cap dotted with cream spots and a cream stem with two black eyes, held in a palm",
    tilt: -1,
  },
];

/** The rest of the crew, inside Work Orders: pieces not in the shop yet, each a ready-made start for a work order. */
export function TheCrew() {
  return (
    <div className="mt-[calc(var(--spacing-section)/2)] border-t border-cocoa/15 pt-[calc(var(--spacing-section)/2)]">
      <h3 id="crew-h" className="font-display text-[clamp(2rem,4vw,3rem)]">
        Or start from the crew
      </h3>
      <p className="mt-4 max-w-[52ch] text-lg leading-relaxed text-brown">
        Turtles, octopuses, mushrooms and hedgehogs are still on the hook, and not in the shop yet. Tap one to ask for your own.
      </p>

      <ul className="mt-9 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {CREW.map((c, i) => (
          <li key={c.src}>
            <Reveal kind="drop" delay={i * 70}>
              <Ticket tone="paper" compactHead head={[c.name]} className="transition-[translate,box-shadow] duration-300 ease-out hf:hover:-translate-y-1.5 hf:hover:shadow-lift" style={{ rotate: `${c.tilt}deg` }}>
                <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-kraft-light">
                  <Image src={c.src} alt={c.alt} fill sizes="(min-width:1024px) 21vw, 45vw" className="object-cover" />
                </div>
                {/* The whole card is the link (stretched from this line), as on the shop's tickets. Named with
                    aria-label, not a visually hidden span: Chrome spaces an absolutely positioned span off
                    ("Make me one : Turtle"). The visible words still lead the name. */}
                <Link
                  href={`/custom?idea=${c.idea}`}
                  aria-label={`Make me one: ${c.name}`}
                  className="mt-2.5 mb-1 flex items-center gap-1.5 rounded-sm px-1 text-[15px] font-semibold text-cocoa after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-4"
                >
                  Make me one
                  <ArrowRight aria-hidden className="size-4 shrink-0" />
                </Link>
              </Ticket>
            </Reveal>
          </li>
        ))}
      </ul>
    </div>
  );
}
