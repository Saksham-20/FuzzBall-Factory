import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name}: ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The maker's own wordmark, read straight off disk so the card never depends on the network. */
export default async function OpengraphImage() {
  const bytes = await readFile(join(process.cwd(), "public", "brand", "logo-wordmark-full.png"));
  const src = `data:image/png;base64,${bytes.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#f6eee3",
          color: "#3f2619",
          position: "relative",
        }}
      >
        <svg
          width="1200"
          height="630"
          viewBox="0 0 1200 630"
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <path
            d="M-20 605 C 200 565, 340 645, 560 605 S 900 565, 1220 615"
            fill="none"
            stroke="#c98586"
            strokeWidth="9"
            strokeLinecap="round"
          />
        </svg>

        <img src={src} width={620} height={425} alt="" style={{ width: 620, height: 425, objectFit: "contain", marginLeft: -16 }} />
        <div style={{ display: "flex", fontSize: 36, marginTop: 8, fontWeight: 700 }}>Cozy crocheted goods</div>
      </div>
    ),
    { ...size },
  );
}
