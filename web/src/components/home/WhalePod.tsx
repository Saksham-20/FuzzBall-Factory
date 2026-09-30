import Image from "next/image";
import Link from "next/link";
import { Ticket } from "@/components/brand/Ticket";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { LoopClip } from "@/components/home/LoopClip";

const WHALES = [
  { key: "red", name: "Red", tilt: -1.5 },
  { key: "yellow", name: "Yellow", tilt: 1 },
  { key: "blue", name: "Blue", tilt: 1.5 },
  { key: "pink", name: "Pink", tilt: -1 },
] as const;

/** The whale keychains, from the maker's own photo and clips: one still of the pod, one loop per colour. */
export function WhalePod() {
  return (
    <section aria-labelledby="pod-h" className="relative overflow-x-clip py-[clamp(3.5rem,7vw,6rem)]">
      <div className="shell">
        <div className="conveyor-indent grid items-start gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
          <Reveal kind="drop" className="mx-auto w-full max-w-[380px] lg:top-28 lg:mx-0 lg-tall:sticky">
            <Ticket head={["Batch #002", "Whale keychains"]} className="-rotate-2">
              <div className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-kraft-light">
                <Image
                  src="/maker/whale-pod.jpg"
                  alt="A hand holding four crochet whale keychains by their gold clasps: pink, red, blue and yellow, each with a white belly"
                  fill
                  sizes="(min-width:1024px) 30vw, 80vw"
                  className="object-cover"
                />
              </div>
              <p className="px-1 pt-3 pb-1 text-sm text-brown">The whole pod, hanging by its clasps.</p>
            </Ticket>
          </Reveal>

          <div>
            <Reveal as="h2" id="pod-h" className="scroll-mt-28 font-display text-[clamp(2.5rem,5.6vw,4.5rem)]">
              Meet the whales
            </Reveal>
            <Reveal as="p" delay={60} className="mt-5 max-w-[52ch] text-lg leading-relaxed text-brown">
              Pocket-sized whale keychains, crocheted by hand with a white belly and a gold clasp. Clip one to your keys, a bag or a zip.
            </Reveal>

            <ul className="mt-9 grid grid-cols-2 gap-4 sm:gap-6">
              {WHALES.map((w, i) => (
                <li key={w.key}>
                  <Reveal kind="drop" delay={(i % 2) * 70}>
                    <Ticket tone="paper" compactHead head={[w.name, "Whale"]} className="transition-[translate,box-shadow] duration-300 ease-out hf:hover:-translate-y-1.5 hf:hover:shadow-lift" style={{ rotate: `${w.tilt}deg` }}>
                      <LoopClip
                        src={`/maker/clips/whale-${w.key}.mp4`}
                        poster={`/maker/clips/whale-${w.key}.jpg`}
                        label={`${w.name} whale keychain turning in a hand`}
                        className="relative aspect-[3/4] overflow-hidden rounded-[10px] bg-kraft-light"
                      />
                    </Ticket>
                  </Reveal>
                </li>
              ))}
            </ul>

            <Reveal delay={80} className="mt-9 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/shop/keychains">Shop keychains</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/custom">Ask for another colour</Link>
              </Button>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
