import { describe, expect, it } from "vitest";
import { takeTrackHandoff, TRACK_HANDOFF_KEY } from "./track-handoff";

const store = (initial?: string) => {
  const m = new Map<string, string>(initial === undefined ? [] : [[TRACK_HANDOFF_KEY, initial]]);
  return { getItem: (k: string) => m.get(k) ?? null, removeItem: (k: string) => void m.delete(k), has: () => m.has(TRACK_HANDOFF_KEY) };
};

describe("takeTrackHandoff", () => {
  it("returns the pair once and clears it", () => {
    const s = store(JSON.stringify({ order: "FB-1023", contact: "+919811122233" }));
    expect(takeTrackHandoff(s)).toEqual({ order: "FB-1023", contact: "+919811122233" });
    expect(s.has()).toBe(false);
    expect(takeTrackHandoff(s)).toBeNull();
  });

  it("ignores nothing, garbage and wrong shapes", () => {
    expect(takeTrackHandoff(store())).toBeNull();
    expect(takeTrackHandoff(store("{not json"))).toBeNull();
    expect(takeTrackHandoff(store(JSON.stringify({ order: 5 })))).toBeNull();
    expect(takeTrackHandoff(undefined)).toBeNull();
  });

  it("survives storage that throws", () => {
    const boom = { getItem: () => { throw new Error("blocked"); }, removeItem: () => undefined };
    expect(takeTrackHandoff(boom)).toBeNull();
  });
});
