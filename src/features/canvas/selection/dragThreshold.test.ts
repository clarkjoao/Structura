import { describe, expect, it } from "vitest";
import { DRAG_THRESHOLD_PX, DRAG_THRESHOLD_PX_SQUARED, isDrag } from "./dragThreshold";

describe("selection/dragThreshold", () => {
  it("exports 4 as the threshold", () => {
    expect(DRAG_THRESHOLD_PX).toBe(4);
    expect(DRAG_THRESHOLD_PX_SQUARED).toBe(16);
  });

  it("treats a 3 px straight-line move as below threshold", () => {
    expect(isDrag(3, 0)).toBe(false);
    expect(isDrag(0, 3)).toBe(false);
  });

  it("treats a 4 px straight-line move as at threshold", () => {
    expect(isDrag(4, 0)).toBe(true);
    expect(isDrag(0, 4)).toBe(true);
  });

  it("treats diagonal distance the same as straight-line", () => {
    // 3² + 0² = 9 (under)
    expect(isDrag(3, 0)).toBe(false);
    // 3² + 3² = 18 (over)
    expect(isDrag(3, 3)).toBe(true);
    // 2² + 3² = 13 (under)
    expect(isDrag(2, 3)).toBe(false);
    // 3² + 2² = 13 (under)
    expect(isDrag(3, 2)).toBe(false);
  });

  it("catches sub-pixel movements from the trackpad as not-drag", () => {
    expect(isDrag(0, 0)).toBe(false);
    expect(isDrag(1, 1)).toBe(false);
    expect(isDrag(2, 2)).toBe(false);
  });
});