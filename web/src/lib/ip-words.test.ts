import { describe, expect, it } from "vitest";
import { flaggedNames } from "@/lib/ip-words";

describe("flaggedNames", () => {
  it("finds well-known character names, ignoring case, accents and hyphens", () => {
    expect(flaggedNames("A cuddly Pikachu keychain")).toEqual(["pikachu"]);
    expect(flaggedNames("POKÉMON-style plush, hello-kitty inspired")).toEqual(["pokemon", "hello kitty"]);
  });

  it("matches whole words only", () => {
    expect(flaggedNames("A mariner whale, a stitching sample, a legolas hat")).toEqual([]);
    expect(flaggedNames("A whale with a gold clasp")).toEqual([]);
  });

  it("reports each name once", () => {
    expect(flaggedNames("snorlax snorlax SNORLAX")).toEqual(["snorlax"]);
  });
});
