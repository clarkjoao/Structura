import { describe, expect, it } from "vitest";
import { allInView } from "./focusComponents";

describe("allInView", () => {
  const box = { x: 100, y: 100, width: 180, height: 80 };

  it("is true for a box wholly on screen, false for one cut by an edge", () => {
    expect(allInView([box], [0, 0, 1], 800, 600)).toBe(true);
    expect(allInView([box], [-150, 0, 1], 800, 600)).toBe(false);
    expect(allInView([box], [0, 0, 1], 250, 600)).toBe(false);
  });

  it("accounts for the zoom", () => {
    // At 2x the box spans 200..560 on screen: inside 600, not inside 500.
    expect(allInView([box], [0, 0, 2], 600, 600)).toBe(true);
    expect(allInView([box], [0, 0, 2], 500, 600)).toBe(false);
  });
});
