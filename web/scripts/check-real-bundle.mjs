// Fails if a real-API build (NEXT_PUBLIC_USE_MOCK=false) still contains the sample database's logins.
// Usage: node scripts/check-real-bundle.mjs [distDir]   (default .next)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = process.argv[2] ?? ".next";
const FORBIDDEN = ["fuzzball123", "admin@fuzzball.test", "maya@example.com", "fbf-mock-v1"];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    // Server source maps stay on the server (never served), so only their code counts; client maps are public.
    else if (/\.(js|css|html|json|txt|map)$/.test(name) && !(dir.includes("server") && name.endsWith(".map"))) yield path;
  }
}

const hits = [];
for (const root of [join(dist, "static"), join(dist, "server")]) {
  try {
    for (const file of files(root)) {
      const text = readFileSync(file, "utf8");
      for (const needle of FORBIDDEN) if (text.includes(needle)) hits.push(`${file}: ${needle}`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

if (hits.length) {
  console.error(`Sample-database strings found in a real-API build (${dist}):\n${hits.map((h) => `  ${h}`).join("\n")}`);
  process.exit(1);
}
console.log(`OK: no sample-database strings in ${dist}.`);
