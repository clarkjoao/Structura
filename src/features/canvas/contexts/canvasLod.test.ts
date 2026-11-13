import { describe, expect, it } from "vitest";
import { LOD_FAR_ENTER_ZOOM, LOD_FAR_EXIT_ZOOM } from "../canvas.constants";
import { nextCanvasLod } from "./canvasLod";

/** Two thresholds, so a zoom resting on the line does not flip the canvas back and forth. */
describe("nextCanvasLod", () => {
  it("enters far below the enter threshold and leaves it above the exit one", () => {
    expect(nextCanvasLod("full", LOD_FAR_ENTER_ZOOM + 0.01)).toBe("full");
    expect(nextCanvasLod("full", LOD_FAR_ENTER_ZOOM - 0.01)).toBe("far");
    expect(nextCanvasLod("far", LOD_FAR_EXIT_ZOOM - 0.01)).toBe("far");
    expect(nextCanvasLod("far", LOD_FAR_EXIT_ZOOM + 0.01)).toBe("full");
  });

  it("holds its level between the two thresholds", () => {
    const between = (LOD_FAR_ENTER_ZOOM + LOD_FAR_EXIT_ZOOM) / 2;
    expect(nextCanvasLod("full", between)).toBe("full");
    expect(nextCanvasLod("far", between)).toBe("far");
  });
});
