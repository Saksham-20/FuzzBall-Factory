import { describe, expect, it } from "vitest";
import { ACK_HOURS, CATEGORIES, RESOLVE_DAYS, dueDates, slaOf, timeLeftLabel } from "@/lib/support";

const t0 = new Date("2026-10-01T10:00:00Z");
const base = (over = {}) => ({ status: "OPEN" as const, kind: "GRIEVANCE" as const, ...dueDates("GRIEVANCE", t0), ackedAt: null, resolvedAt: null, ...over });

describe("support rules (the web mirror of the API's)", () => {
  it("promises 48 hours to acknowledge and a month for a complaint", () => {
    const d = dueDates("GRIEVANCE", t0);
    expect(d.ackDueAt.getTime() - t0.getTime()).toBe(ACK_HOURS * 3_600_000);
    expect(d.resolveDueAt.getTime() - t0.getTime()).toBe(RESOLVE_DAYS.GRIEVANCE * 86_400_000);
    expect(RESOLVE_DAYS.GRIEVANCE).toBe(30);
  });

  it("walks the acknowledgement clock from ok to overdue, and stops it once answered", () => {
    const at = (h: number) => new Date(t0.getTime() + h * 3_600_000);
    expect(slaOf(base(), at(1)).ack).toBe("ok");
    expect(slaOf(base(), at(40)).ack).toBe("due-soon");
    expect(slaOf(base(), at(49)).ack).toBe("overdue");
    expect(slaOf(base({ ackedAt: t0 }), at(500)).ack).toBe("done");
  });

  it("words a deadline instead of leaving it to colour", () => {
    expect(timeLeftLabel(5 * 3_600_000)).toBe("5 hours left");
    expect(timeLeftLabel(60_000)).toBe("1 hour left");
    expect(timeLeftLabel(-3 * 86_400_000)).toBe("overdue by 3 days");
    expect(timeLeftLabel(-2 * 3_600_000)).toBe("overdue by 2 hours");
  });

  it("offers topics for every kind", () => {
    for (const kind of Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]) expect(CATEGORIES[kind].length).toBeGreaterThan(0);
  });
});
