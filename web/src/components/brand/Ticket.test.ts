import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { headLayout } from "./Ticket";

describe("headLayout", () => {
  it("between two text labels, keeps the left whole and cuts the right short", () => {
    expect(headLayout("One of one")).toEqual({ hasRight: true, left: "shrink-0 whitespace-nowrap", right: "min-w-0 truncate" });
  });

  it("lets text give way to an element, so a badge stays whole", () => {
    expect(headLayout(createElement("span", null, "Default"))).toEqual({ hasRight: true, left: "min-w-0 truncate", right: "shrink-0" });
  });

  it.each([undefined, null, false, ""])("treats %j on the right as nothing, so a lone label truncates", (right) => {
    expect(headLayout(right)).toEqual({ hasRight: false, left: "min-w-0 truncate", right: "shrink-0" });
  });

  it("counts 0 as a label", () => {
    expect(headLayout(0)).toMatchObject({ hasRight: true, right: "min-w-0 truncate" });
  });
});
