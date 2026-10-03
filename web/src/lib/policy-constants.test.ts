import { describe, expect, it } from "vitest";
import { POLICY } from "@/lib/policy-constants";
import { refundPolicy } from "@/components/content/policies/refund";

describe("policy constants", () => {
  it("keep the defect window at or above the 30-day statutory floor", () => {
    expect(POLICY.defectWindowDays).toBeGreaterThanOrEqual(30);
  });

  it("are quoted in the refund policy's own summary", () => {
    const text = JSON.stringify(refundPolicy.summary.points);
    expect(text).toContain(String(POLICY.returnWindowDays));
    expect(text).toContain(String(POLICY.defectWindowDays));
    expect(text).toContain(POLICY.refundArrival);
  });
});
