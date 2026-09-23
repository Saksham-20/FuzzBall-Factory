"use client";

import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Dialog";
import { waLink } from "@/lib/whatsapp";
import type { Product } from "@/lib/types";

interface Chart {
  cols: string[];
  rows: string[][];
  measure: string[];
  note?: string;
}

// PLACEHOLDER(size-chart): stand-in measurements in cm. The maker supplies the real chart per product.
const CHARTS: Record<string, Chart> = {
  "midnight-beanie": {
    cols: ["Size", "Head (cm)", "Height (cm)"],
    rows: [
      ["S", "52–54", "20"],
      ["M", "54–56", "21"],
      ["L", "56–58", "22"],
    ],
    measure: [
      "Wrap a soft tape measure around your head, just above the eyebrows and ears.",
      "Read the number in centimetres. Crochet stretches, so if you are between sizes, choose the smaller one for a snug fit.",
    ],
  },
  "sunny-halter": {
    cols: ["Size", "Bust (cm)", "Underbust (cm)", "Length (cm)"],
    rows: [
      ["XS", "78–82", "64–68", "30"],
      ["S", "83–87", "69–73", "31"],
      ["M", "88–92", "74–78", "32"],
      ["L", "93–97", "79–83", "33"],
    ],
    measure: [
      "Bust: measure around the fullest part of your chest, with the tape level.",
      "Underbust: measure around your ribcage, just under the bust.",
      "Length: from the top of your shoulder to where you want the hem to sit.",
    ],
    note: "Between sizes, or want it exact? This piece can be made to your own measurements. We will ask for them after you order.",
  },
};

const FALLBACK: Chart = {
  cols: [],
  rows: [],
  measure: [
    "Use a soft tape measure and read in centimetres.",
    "Measure over the clothes or body part this piece will sit on, keeping the tape snug but not tight.",
  ],
};

// PLACEHOLDER(size-chart): generic category-level charts, shown for a sized product that has no exact chart
// of its own above. Kept broad on purpose — the maker's real per-product chart should replace each one.
const CATEGORY_CHARTS: Record<"wearables-hat" | "wearables-top", Chart> = {
  "wearables-hat": {
    cols: ["Size", "Head (cm)"],
    rows: [
      ["S", "52–54"],
      ["M", "54–56"],
      ["L", "56–58"],
    ],
    measure: [
      "Wrap a soft tape measure around your head, just above the eyebrows and ears.",
      "Read the number in centimetres. Crochet stretches, so if you are between sizes, choose the smaller one for a snug fit.",
    ],
    note: "General ranges for our hats. Ask us on WhatsApp for this piece's exact measurements.",
  },
  "wearables-top": {
    cols: ["Size", "Bust (cm)", "Length (cm)"],
    rows: [
      ["XS", "78–82", "28"],
      ["S", "83–87", "29"],
      ["M", "88–92", "30"],
      ["L", "93–97", "31"],
    ],
    measure: [
      "Bust: measure around the fullest part of your chest, with the tape level.",
      "Length: from the top of your shoulder to where you want the hem to sit.",
    ],
    note: "General ranges for our tops. Ask us on WhatsApp for this piece's exact measurements.",
  },
};

/** Best-guess category chart for a sized product with no exact-slug chart, from its category and name/tagline. */
function categoryChart(product: Pick<Product, "category" | "name" | "tagline">): Chart | undefined {
  if (product.category !== "wearables") return undefined;
  const text = `${product.name} ${product.tagline}`.toLowerCase();
  if (/\b(beanie|hat|cap|hood|headband)\b/.test(text)) return CATEGORY_CHARTS["wearables-hat"];
  return CATEGORY_CHARTS["wearables-top"];
}

export function SizeGuide({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: Pick<Product, "slug" | "name" | "category" | "tagline">;
}) {
  const chart = CHARTS[product.slug] ?? categoryChart(product) ?? FALLBACK;
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Size guide"
      description={product.name}
      footer={
        <Button asChild variant="secondary">
          <a
            href={waLink(`Hi! Could you help me pick a size for *${product.name}*?`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ask about sizing on WhatsApp
          </a>
        </Button>
      }
    >
      <div data-placeholder="size-chart" className="relative pb-6">
        {chart.rows.length > 0 ? (
          <div className="overflow-x-auto rounded-[12px] bg-cream">
            <table className="tabular w-full text-left text-[15px]">
              <caption className="sr-only">Size chart in centimetres for {product.name}</caption>
              <thead>
                <tr className="border-b border-line">
                  {chart.cols.map((c) => (
                    <th key={c} scope="col" className="px-3.5 py-3 text-sm font-bold whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((r) => (
                  <tr key={r[0]} className="border-b border-line last:border-0">
                    {r.map((cell, i) =>
                      i === 0 ? (
                        <th key={i} scope="row" className="px-3.5 py-3 font-bold">
                          {cell}
                        </th>
                      ) : (
                        <td key={i} className="px-3.5 py-3">
                          {cell}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-brown">This piece has no fixed size chart. Message us and we will check the fit for you.</p>
        )}

        {chart.note ? <p className="mt-4 max-w-[60ch] text-brown">{chart.note}</p> : null}

        <h3 className="mt-8 text-lg font-bold">How to measure</h3>
        <ol className="mt-3 max-w-[60ch] list-decimal space-y-2 pl-5 text-brown marker:font-bold marker:text-cocoa">
          {chart.measure.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ol>
      </div>
    </Drawer>
  );
}
