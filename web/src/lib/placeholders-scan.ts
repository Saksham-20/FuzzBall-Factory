import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * A launch build (LAUNCH_BUILD=true, see build-env.ts) refuses to ship while stand-in content is still tagged in the
 * source. Every stand-in carries a `PLACEHOLDER(<id>)` tag (registry: docs/PLACEHOLDERS.md). Accepted leftovers are named
 * in PLACEHOLDERS_ALLOWED (comma-separated ids), so shipping with one is a decision, not an accident.
 * The literal example tag `id` (used in doc comments) is ignored.
 */
const TAG = /PLACEHOLDER\(([a-z0-9-]+)\)/g;
const SOURCE = /\.(ts|tsx)$/;

function* sourceFiles(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (SOURCE.test(name) && !/\.test\.tsx?$/.test(name) && name !== "placeholders-scan.ts") yield path;
  }
}

/** id -> files that carry the tag (relative to `root`). */
export function scanPlaceholders(dir: string, root = dir): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of sourceFiles(dir)) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(TAG)) {
      const id = match[1];
      if (id === "id") continue;
      const files = found.get(id) ?? [];
      const shown = relative(root, file);
      if (!files.includes(shown)) files.push(shown);
      found.set(id, files);
    }
  }
  return found;
}

export function placeholderProblems(found: Map<string, string[]>, allowed: string | undefined): string[] {
  const allow = new Set((allowed ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  return [...found.entries()]
    .filter(([id]) => !allow.has(id))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, files]) => `PLACEHOLDER(${id}) in ${files.join(", ")}`);
}

/** Throws one readable error listing every unresolved stand-in. */
export function assertNoPlaceholders(srcDir: string, allowed: string | undefined): void {
  const problems = placeholderProblems(scanPlaceholders(srcDir, join(srcDir, "..")), allowed);
  if (problems.length) {
    throw new Error(
      `Refusing to build a launch build: ${problems.length} placeholder(s) still tagged (docs/PLACEHOLDERS.md).\n` +
        `${problems.map((p) => `  - ${p}`).join("\n")}\n` +
        "Resolve them, or accept one on purpose with PLACEHOLDERS_ALLOWED=id1,id2.",
    );
  }
}
