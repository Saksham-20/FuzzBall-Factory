import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The maker's own circular FF mark, read straight off disk so the favicon never depends on the network. */
export default async function Icon() {
  const bytes = await readFile(join(process.cwd(), "public", "brand", "logo-mark-circle.png"));
  const src = `data:image/png;base64,${bytes.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        <img src={src} width={64} height={64} alt="" style={{ width: 64, height: 64, objectFit: "contain" }} />
      </div>
    ),
    { ...size },
  );
}
