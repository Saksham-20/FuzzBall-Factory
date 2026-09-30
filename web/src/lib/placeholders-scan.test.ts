import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assertNoPlaceholders, placeholderProblems, scanPlaceholders } from "./placeholders-scan";

let root: string;
let src: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "fbf-ph-"));
  src = join(root, "src");
  mkdirSync(join(src, "components"), { recursive: true });
  writeFileSync(join(src, "site.ts"), "// PLACEHOLDER(whatsapp-number): real number\nexport const a = 1;\n// Every value tagged PLACEHOLDER(id) must go\n");
  writeFileSync(join(src, "components", "Legal.tsx"), "{/* PLACEHOLDER(legal-details) */}\n{/* PLACEHOLDER(legal-details) again */}\n");
  writeFileSync(join(src, "components", "Legal.test.ts"), "// PLACEHOLDER(only-in-tests)\n");
  writeFileSync(join(src, "notes.md"), "PLACEHOLDER(not-source)\n");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("scanPlaceholders", () => {
  it("finds tags in ts/tsx source, once per file, ignoring tests, other files and the example tag", () => {
    const found = scanPlaceholders(src, root);
    expect([...found.keys()].sort()).toEqual(["legal-details", "whatsapp-number"]);
    expect(found.get("legal-details")).toEqual(["src/components/Legal.tsx"]);
  });
});

describe("placeholderProblems / assertNoPlaceholders", () => {
  it("lists what is left and honours the allow list", () => {
    const found = scanPlaceholders(src, root);
    expect(placeholderProblems(found, undefined)).toHaveLength(2);
    expect(placeholderProblems(found, "legal-details, whatsapp-number")).toEqual([]);
    expect(placeholderProblems(found, "legal-details")).toEqual(["PLACEHOLDER(whatsapp-number) in src/site.ts"]);
  });

  it("throws a readable error, and passes when everything is accepted", () => {
    expect(() => assertNoPlaceholders(src, undefined)).toThrowError(/2 placeholder\(s\)[\s\S]*legal-details[\s\S]*whatsapp-number/);
    expect(() => assertNoPlaceholders(src, "legal-details,whatsapp-number")).not.toThrow();
  });
});
