import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Ticket } from "@/components/brand/Ticket";
import { Ph } from "@/components/content/Placeholder";
import { ReadLayout } from "@/components/content/ReadLayout";
import { Button } from "@/components/ui/Button";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description:
    "FuzzBall Factory is a one-person crochet studio in India. Every plushie, bouquet, bag and charm is hooked by hand, ready to ship or made to order, always from original designs.",
  alternates: { canonical: "/about" },
};

/*
 * PLACEHOLDER(maker-note): the maker's name, photo and story. Everything else on this page describes
 * how the shop works and holds no invented facts (no years, awards, order counts or press).
 * PLACEHOLDER(copy-process): the making-process wording is generic until the maker confirms it.
 */
export default function AboutPage() {
  return (
    <ReadLayout
      title="Made by one pair of hands"
      intro={`${SITE.name} is a small crochet studio. Every piece is hooked by hand, one loop at a time, and shipped from India.`}
      noHelp
      lead={
        <figure className="mb-14">
          <div data-placeholder="sample-photo" className="relative aspect-[4/3] overflow-hidden rounded-ticket bg-kraft-light">
            <Image
              src="/samples/yarn-assorted.jpg"
              alt="Balls of yarn in assorted colours"
              fill
              sizes="(min-width:1024px) 68ch, 100vw"
              className="object-cover"
              priority
            />
          </div>
          <figcaption className="font-stencil mt-2 text-[12px] text-brown-soft">Sample photo. The maker&apos;s own pictures go here.</figcaption>
        </figure>
      }
      sections={[
        {
          id: "how-its-made",
          title: "How a piece is made",
          body: (
            <div data-placeholder="copy-process" className="relative space-y-4">
              <p>
                Every piece starts with choosing the yarn. Soft milk cotton suits plushies, sturdy cotton suits bags and coasters, wool blends suit
                hats. The fibre is listed on every product page.
              </p>
              <p>
                Then it is hooked row by row, by hand. Plushies are stuffed and sewn up, details are stitched or embroidered on, and each piece is
                checked before it is packed to travel.
              </p>
              <p>There are no machines and no factory line. Handmade means small differences: a shade of yarn, a stitch or two in size. It also means no two are exactly alike.</p>
            </div>
          ),
        },
        {
          id: "made-to-order",
          title: "What “made to order” means",
          body: (
            <>
              <p>
                <strong>Ready to ship</strong> pieces are already made. They leave within a day or two of your order.
              </p>
              <p>
                <strong>Made to order</strong> pieces are crocheted after you order, so they take longer. We show the lead time on the product page,
                in your cart and at checkout, with an estimated dispatch date, so you know before you pay.
              </p>
              <p>
                <strong>Custom work orders</strong> are for pieces made to your idea, or an existing design changed to your colours, size or name.
                You tell us what you want and your budget, we send a quote, and you can accept it, counter it or decline. See{" "}
                <Link href="/custom">work orders</Link> and the <Link href="/faq">FAQ</Link>.
              </p>
            </>
          ),
        },
        {
          id: "values",
          title: "What we care about",
          body: (
            <ul>
              <li>
                <strong>Handmade, really.</strong> One maker crochets every piece. We say so plainly, and we say how long it takes.
              </li>
              <li>
                <strong>Original designs only.</strong> We do not make licensed characters or copy other makers. If you want a favourite character, we
                will offer an original design in the same spirit instead.
              </li>
              <li>
                <strong>Honest about colour and size.</strong> Sizes are in cm. Screens and dye lots vary, so we will send a photo in natural light on
                request.
              </li>
              <li>
                <strong>No invented proof.</strong> We do not show reviews, counts or press we do not have. Real reviews appear on product pages when
                customers write them.
              </li>
            </ul>
          ),
        },
        {
          id: "maker",
          title: "Who is behind it",
          body: (
            <div className="grid items-start gap-6 sm:grid-cols-[minmax(0,11rem)_1fr]">
              <Ticket head={["Maker"]} hole={false} className="w-full max-w-[11rem]">
                <Ph id="maker-note" block className="grid aspect-[4/5] place-items-center rounded-[10px] bg-paper/70 p-3 text-center text-sm">
                  [Maker photo]
                </Ph>
              </Ticket>
              <div className="space-y-4">
                <p>
                  <Ph id="maker-note">[Maker&apos;s name]</Ph>
                </p>
                <p>
                  <Ph id="maker-note">
                    [The maker&apos;s story in their own words: how crochet started, what they love making, why they began this shop. A few honest
                    sentences are enough.]
                  </Ph>
                </p>
              </div>
            </div>
          ),
        },
        {
          id: "next",
          title: "Come and say hello",
          body: (
            <>
              <p>Browse what is on the shelf, or tell us what you would like made.</p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button asChild size="lg">
                  <Link href="/shop">Shop the shelf</Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/custom">Start a work order</Link>
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <Link href="/contact">Contact us</Link>
                </Button>
              </div>
            </>
          ),
        },
      ]}
    />
  );
}
