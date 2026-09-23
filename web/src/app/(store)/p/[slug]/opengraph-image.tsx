import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getProduct } from "@/lib/mock/catalog";
import { formatINR } from "@/lib/format";
import { SITE } from "@/lib/site";

export const alt = "A handmade crochet piece from FuzzBall Factory";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CREAM = "#f6eee3";
const COCOA = "#3f2619";
const BROWN = "#6b4228";
const KRAFT = "#d4ae80";
const BUTTER = "#f4cd52";

/** Reads a /public image straight from disk and inlines it, so the card never depends on the network. */
async function inlineImage(src: string) {
  try {
    const bytes = await readFile(join(process.cwd(), "public", src));
    const type = src.endsWith(".png") ? "image/png" : "image/jpeg";
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getProduct(slug);
  const photo = p ? await inlineImage(p.images[0].src) : null;
  const lead = p ? (p.fulfilment === "READY" ? "Ready to ship" : `Made to order · ${p.leadTimeDays} days`) : "Crocheted by hand in India";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: CREAM, padding: 44, fontFamily: "sans-serif" }}>
        {/* Photo, framed like a kraft job ticket */}
        <div style={{ display: "flex", width: 462, height: 542, background: KRAFT, borderRadius: 22, padding: 16, flexShrink: 0 }}>
          {photo ? (
            <img src={photo} alt="" width={430} height={510} style={{ width: 430, height: 510, objectFit: "cover", borderRadius: 14 }} />
          ) : (
            <div style={{ display: "flex", width: 430, height: 510, background: CREAM, borderRadius: 14 }} />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1, paddingLeft: 56, paddingRight: 12 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ display: "flex", background: BUTTER, color: COCOA, fontSize: 24, fontWeight: 700, padding: "8px 18px", borderRadius: 999 }}>
                {p ? `BATCH #${String(p.batch).padStart(3, "0")}` : "FUZZBALL FACTORY"}
              </div>
            </div>
            <div style={{ display: "flex", marginTop: 32, fontSize: p && p.name.length > 26 ? 60 : 72, lineHeight: 1.05, fontWeight: 700, color: COCOA, letterSpacing: -1.5 }}>
              {p ? p.name : "Handmade crochet"}
            </div>
            <div style={{ display: "flex", marginTop: 20, fontSize: 30, color: BROWN }}>{lead}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {p ? <div style={{ display: "flex", fontSize: 64, fontWeight: 700, color: COCOA }}>{formatINR(p.price)}</div> : null}
            <div style={{ display: "flex", marginTop: 14, fontSize: 28, fontWeight: 700, color: BROWN }}>
              {SITE.name} · {SITE.tagline}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
