// Emits the site's yarn ball (web/src/components/brand/yarn-geometry.ts) as an inline SVG snippet.
import { WRAPS, FORM_SHADOW } from "../../../web/src/components/brand/yarn-geometry.ts";
import { writeFileSync } from "node:fs";

const c = { base: "#c98586", dark: "#a95f62", light: "#e2acab" };
const w = WRAPS.full;
const layers = w.layers
  .map((l) =>
    [
      l.shadow ? `<path d="${l.shadow}" fill="${c.dark}" opacity="0.3"/>` : "",
      l.fill ? `<path d="${l.fill}" fill="${c.base}"/>` : "",
      l.strands.length ? `<path d="${l.strands.join("")}" stroke="${c.dark}" stroke-width="${w.stroke}"/>` : "",
      ...l.highlights.map((d) => `<path d="${d}" stroke="${c.light}" stroke-width="${w.highlight}" opacity="0.9"/>`),
    ].join(""),
  )
  .join("");

const html = `<div id="ball-face"><div id="ball-rock" data-layout-allow-overflow><svg id="ball-wraps" viewBox="10 10 380 380" fill="none" stroke-linecap="round">${layers}</svg></div></div>
<svg id="ball-rim" viewBox="0 0 400 400"><path d="${FORM_SHADOW}" fill="${c.dark}" opacity="0.2"/><circle cx="200" cy="200" r="190" fill="none" stroke="${c.dark}" stroke-width="5"/></svg>`;
writeFileSync(new URL("../src/ball.html", import.meta.url), html);
console.log("ball.html", html.length, "bytes");
