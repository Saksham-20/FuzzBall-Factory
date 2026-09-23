import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/content/Prose";
import { ReadLayout } from "@/components/content/ReadLayout";
import { waLink } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Size guide",
  description:
    "Size guide for crochet beanies (XS to L, head circumference in cm) and tops (bust and length in cm), plus how to measure yourself at home.",
  alternates: { canonical: "/size-guide" },
};

/*
 * PLACEHOLDER(size-chart): generic body-measurement ranges for handmade wearables. The maker must
 * confirm these against their own patterns and finished sizes before launch. All values are cm.
 */
export default function SizeGuidePage() {
  return (
    <ReadLayout
      title="Size guide"
      intro="All sizes are in centimetres. Crochet stretches, but a good measurement still gives the best fit."
      sections={[
        {
          id: "measure",
          title: "How to measure",
          body: (
            <>
              <p>
                Use a soft tape measure, or a piece of string and a ruler. Measure over thin clothing or bare skin, keep the tape snug but not tight, and
                ask a friend to help if you can.
              </p>
              <ul>
                <li>
                  <strong>Head:</strong> wrap the tape around your head just above your eyebrows and ears, over the widest part at the back. Read the
                  number where the tape meets.
                </li>
                <li>
                  <strong>Bust:</strong> wrap the tape around the fullest part of your chest, keeping it level across your back.
                </li>
                <li>
                  <strong>Waist:</strong> wrap the tape around the narrowest part of your waist, usually just above the belly button.
                </li>
                <li>
                  <strong>Length:</strong> for a top, measure from the point where your neck meets your shoulder down to where you want it to end.
                </li>
              </ul>
              <p>If you are between two sizes, size up for a loose, slouchy fit and size down for a snug one.</p>
            </>
          ),
        },
        {
          id: "beanies",
          title: "Beanies and hats",
          body: (
            <>
              <div data-placeholder="size-chart" className="relative">
                <DataTable
                  caption="Beanie sizes by head circumference in centimetres"
                  head={["Size", "Head circumference (cm)"]}
                  rows={[
                    ["XS", "48 to 50"],
                    ["S", "51 to 53"],
                    ["M", "54 to 56"],
                    ["L", "57 to 59"],
                  ]}
                />
              </div>
              <p>
                Beanies stretch a little, so the finished piece is made slightly smaller than your head. Slouchy styles need extra length, not extra
                width, so the head measurement is what matters. A product page may list its own fit; if it does, follow that.
              </p>
            </>
          ),
        },
        {
          id: "tops",
          title: "Tops",
          body: (
            <>
              <div data-placeholder="size-chart" className="relative">
                <DataTable
                  caption="Top sizes by bust and finished length in centimetres"
                  head={["Size", "Bust (cm)", "Finished length (cm)"]}
                  rows={[
                    ["XS", "78 to 82", "32 to 36"],
                    ["S", "83 to 87", "33 to 37"],
                    ["M", "88 to 92", "34 to 38"],
                    ["L", "93 to 97", "35 to 39"],
                  ]}
                />
              </div>
              <p>
                Finished length varies with the style: a crop top is shorter than a halter with a scalloped hem. Ties and straps can be adjusted. Check the
                measurements on the product page for that piece.
              </p>
            </>
          ),
        },
        {
          id: "custom",
          title: "Made to your measurements",
          body: (
            <p>
              Not sure, or between sizes? Send your measurements and we will check them against the pattern. You can also{" "}
              <a href={waLink("Hi! I'd like help choosing a size. My measurements are:")} target="_blank" rel="noopener noreferrer">
                ask on WhatsApp
              </a>{" "}
              or <Link href="/custom">start a work order</Link> for a piece made to fit you. Because made-to-order wearables are made for you, please
              double-check your size before ordering. See the <Link href="/policies/refund">refund policy</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}
