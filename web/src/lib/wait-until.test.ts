import { describe, expect, it } from "vitest";
import { waitUntil } from "./wait-until";

const instant = () => Promise.resolve();

describe("waitUntil", () => {
  it("returns true as soon as the check passes", async () => {
    let calls = 0;
    const ok = await waitUntil(() => Promise.resolve(++calls === 3), { timeoutMs: 10_000, everyMs: 1000, sleep: instant });
    expect(ok).toBe(true);
    expect(calls).toBe(3);
  });

  it("gives up after the timeout and reports false", async () => {
    let calls = 0;
    const ok = await waitUntil(() => { calls += 1; return Promise.resolve(false); }, { timeoutMs: 3000, everyMs: 1000, sleep: instant });
    expect(ok).toBe(false);
    expect(calls).toBe(4); // t=0,1000,2000,3000
  });

  it("treats a throwing check as not yet", async () => {
    let calls = 0;
    const ok = await waitUntil(() => (++calls < 3 ? Promise.reject(new Error("offline")) : Promise.resolve(true)), { timeoutMs: 10_000, everyMs: 1000, sleep: instant });
    expect(ok).toBe(true);
  });
});
