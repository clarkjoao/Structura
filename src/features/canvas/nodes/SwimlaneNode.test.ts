import { describe, expect, it } from "vitest";
import { withAlpha } from "./SwimlaneNode";

describe("withAlpha", () => {
  it("applies alpha to a hex color", () => {
    expect(withAlpha("#6366f1", 50)).toBe("rgba(99, 102, 241, 0.5)");
  });

  it("applies alpha to an hsl color instead of dropping it", () => {
    // Regression: hsl presets used to bypass alpha entirely and render fully opaque.
    expect(withAlpha("hsl(220 70% 50%)", 30)).toBe("rgba(38, 98, 217, 0.3)");
  });

  it("clamps opacity to the 0-100 range", () => {
    expect(withAlpha("#000000", 150)).toBe("rgba(0, 0, 0, 1)");
    expect(withAlpha("#000000", -10)).toBe("rgba(0, 0, 0, 0)");
  });

  it("falls back to the original color when it can't be parsed", () => {
    expect(withAlpha("not-a-color", 50)).toBe("not-a-color");
  });
});
