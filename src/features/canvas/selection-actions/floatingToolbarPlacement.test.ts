import { describe, expect, it } from "vitest";
import { placeFloatingToolbar } from "./floatingToolbarPlacement";

const viewport = { width: 1000, height: 700 };
const toolbar = { width: 200, height: 36 };

describe("placeFloatingToolbar", () => {
  it("sits above a selection that has room over it, centred on it", () => {
    const p = placeFloatingToolbar({
      target: { x: 400, y: 300, width: 100, height: 80 },
      toolbar,
      viewport,
    });
    expect(p).toEqual({ x: 350, y: 300 - 10 - 36, side: "top" });
  });

  it("flips below when the top has no room but the selection's top is on screen", () => {
    const p = placeFloatingToolbar({
      target: { x: 400, y: 20, width: 100, height: 80 },
      toolbar,
      viewport,
    });
    expect(p.side).toBe("bottom");
    expect(p.y).toBe(20 + 80 + 10);
  });

  it("pins inside the visible part of a group taller than the screen", () => {
    const p = placeFloatingToolbar({
      target: { x: -200, y: -500, width: 1800, height: 2000 },
      toolbar,
      viewport,
    });
    expect(p.side).toBe("inside");
    expect(p.y).toBeGreaterThanOrEqual(8);
    expect(p.y + toolbar.height).toBeLessThanOrEqual(viewport.height - 8);
    // Centred on the visible part, not on the group's off-screen centre.
    expect(p.x).toBe(500 - 100);
  });

  it("stays inside the canvas horizontally", () => {
    const p = placeFloatingToolbar({
      target: { x: 960, y: 300, width: 100, height: 80 },
      toolbar,
      viewport,
    });
    expect(p.x).toBe(1000 - 200 - 8);
  });

  it("brings a selection that is wholly off-screen to the nearest edge", () => {
    const p = placeFloatingToolbar({
      target: { x: 3000, y: 3000, width: 100, height: 80 },
      toolbar,
      viewport,
    });
    expect(p.x).toBe(1000 - 200 - 8);
    expect(p.y).toBe(700 - 36 - 8);
  });
});
