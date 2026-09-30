// src/index.template.html + src/ball.html -> index.html
import { readFileSync, writeFileSync } from "node:fs";
const ball = readFileSync(new URL("../src/ball.html", import.meta.url), "utf8");
const yarn = `<svg viewBox="0 0 50 50" fill="none" stroke-linecap="round"><circle cx="25" cy="25" r="21" fill="#c98586" stroke="#a95f62" stroke-width="3"/><path d="M8 20C18 26 32 26 43 18M6 30C18 37 34 36 45 28M17 7C24 16 25 34 20 44" stroke="#a95f62" stroke-width="2.5"/></svg>`;
let html = readFileSync(new URL("../src/index.template.html", import.meta.url), "utf8");
html = html.replace("<!--BALL-->", ball).replaceAll("<!--YARN-->", yarn);
writeFileSync(new URL("../index.html", import.meta.url), html);
console.log("index.html", html.length);
