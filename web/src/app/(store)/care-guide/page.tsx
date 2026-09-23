import type { Metadata } from "next";
import Link from "next/link";
import { ReadLayout } from "@/components/content/ReadLayout";

export const metadata: Metadata = {
  title: "Care guide",
  description:
    "How to wash and store crochet: milk cotton, cotton, acrylic, chenille and wool blend yarns, plus plushie care and storage tips.",
  alternates: { canonical: "/care-guide" },
};

/*
 * General craft knowledge, not a claim about any specific product. The care note on each product page
 * always comes first. The maker should confirm it matches their yarns.
 */
export default function CareGuidePage() {
  return (
    <ReadLayout
      title="Care guide"
      intro="Handmade crochet lasts for years when it is washed gently and stored dry. Start with the care note on your product's page, then use this guide."
      sections={[
        {
          id: "basics",
          title: "The basics for every piece",
          body: (
            <ul>
              <li>Wash only when needed. Spot-clean small marks with a damp cloth and a little mild soap.</li>
              <li>Use cool water and a mild detergent. Hot water can shrink or felt yarn.</li>
              <li>Do not wring or twist. Press the water out gently in a clean towel.</li>
              <li>Dry flat, away from direct sun and heaters. Never tumble dry.</li>
              <li>Wash strong colours, especially reds and darks, separately the first time, in case the dye runs.</li>
            </ul>
          ),
        },
        {
          id: "fibres",
          title: "By fibre",
          body: (
            <>
              <p>The fibre is listed on every product page. Here is what each one likes.</p>
              <h3>Milk cotton</h3>
              <p>
                A soft, smooth cotton-blend yarn, popular for plushies. The exact blend differs between brands, so treat it gently. Hand wash in cool water, do
                not wring, and dry flat. It may shrink a little with heat.
              </p>
              <h3>Cotton</h3>
              <p>
                Strong and easy to care for, good for coasters, bags and flowers. Hand wash in cool or lukewarm water. Flat items with no stuffing can go in a
                gentle cycle inside a mesh bag. Dry flat. Cotton can shrink in heat, so avoid hot water and hot dryers.
              </p>
              <h3>Acrylic</h3>
              <p>
                Light, and it holds its colour. Hand wash in cool water and air dry. Keep away from high heat and irons, because acrylic can melt or go limp.
                It can pill with friction; pills can be trimmed off with a fabric shaver or small scissors.
              </p>
              <h3>Chenille</h3>
              <p>
                Velvety and delicate. Spot-clean if you can. If it needs a wash, use cool water and a very gentle squeeze, without rubbing. Do not wring. Dry flat
                and, once dry, fluff the pile with a soft brush. Avoid rough surfaces, which can snag or shed the pile.
              </p>
              <h3>Wool blend</h3>
              <p>
                Warm and springy. Wash with cool water and a wool wash, without rubbing or soaking for long. Heat and rubbing can felt the fibres and shrink the
                piece. Press out the water in a towel and dry flat, reshaping as it dries. Do not hang it wet.
              </p>
            </>
          ),
        },
        {
          id: "plushies",
          title: "Plushies and stuffed pieces",
          body: (
            <>
              <ul>
                <li>Clean the surface with a damp cloth and a little mild soap. This is usually enough.</li>
                <li>Avoid the washing machine. It can clump the stuffing and loosen seams and safety eyes.</li>
                <li>If you must wash it, hand wash, press out the water, and dry until it is dry all the way through. Damp stuffing can go musty.</li>
                <li>Check seams, eyes and small parts now and then. Mend loose stitches early.</li>
                <li>
                  Plushies and small parts are not toys for children under 3 unless the product page says the piece is made for that age. Supervise young
                  children, and keep pieces away from pets who chew.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "storage",
          title: "Storing your crochet",
          body: (
            <ul>
              <li>Store completely dry, in a cool, airy place. Damp air causes mildew.</li>
              <li>Use a cotton bag or a box. Avoid sealing pieces in plastic for a long time.</li>
              <li>Fold wearables flat instead of hanging them, so they do not stretch out of shape.</li>
              <li>Keep flower bouquets upright, or lying flat with nothing on top, so the stems and petals keep their shape.</li>
              <li>Keep out of long direct sunlight, which fades colour. Keep wool blends safe from moths.</li>
            </ul>
          ),
        },
        {
          id: "snags",
          title: "Snags, pills and small repairs",
          body: (
            <>
              <p>
                If a stitch snags, do not cut it. Push the loop through to the inside with a crochet hook or the tip of a needle. Trim pills gently, and
                keep sharp jewellery and rough zips away from delicate yarn.
              </p>
              <p>
                If something needs mending, message us. The <Link href="/policies/refund">refund policy</Link> explains what we repair or replace, and
                the <Link href="/faq">FAQ</Link> answers common questions.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
