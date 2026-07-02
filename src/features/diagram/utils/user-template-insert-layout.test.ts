import { describe, expect, it } from "vitest";
import { computeUserTemplateNodeLayouts } from "./user-template-insert-layout";

describe("computeUserTemplateNodeLayouts", () => {
  it("preserves relative offsets between sibling roots at insertion point", () => {
    const insertionPoint = { x: 500, y: 400 };
    const templateComponents = [
      { _relX: -100, _relY: -50 },
      { _relX: 100, _relY: 50 },
    ];
    const layouts = computeUserTemplateNodeLayouts(templateComponents, insertionPoint);
    expect(layouts[0]).toMatchObject({ x: 400, y: 350 });
    expect(layouts[1]).toMatchObject({ x: 600, y: 450 });
    expect(layouts[1].x - layouts[0].x).toBe(200);
    expect(layouts[1].y - layouts[0].y).toBe(100);
  });

  it("uses child _relX/_relY directly (already relative to parent in React Flow)", () => {
    const insertionPoint = { x: 500, y: 400 };
    const templateComponents = [
      { _relX: -100, _relY: -50 },
      { _relX: 70, _relY: 30, parentIndex: 0 },
    ];
    const layouts = computeUserTemplateNodeLayouts(templateComponents, insertionPoint);
    expect(layouts[0]).toMatchObject({ x: 400, y: 350 });
    expect(layouts[1]).toMatchObject({ x: 70, y: 30 });
  });

  it("resolves legacy x/y when _relX/_relY are absent", () => {
    const layouts = computeUserTemplateNodeLayouts([{ x: 10, y: 20 } as { x: number; y: number }], {
      x: 0,
      y: 0,
    });
    expect(layouts[0]).toMatchObject({ x: 10, y: 20 });
  });

  it("preserves panel width and height", () => {
    const layouts = computeUserTemplateNodeLayouts(
      [{ _relX: 0, _relY: 0, width: 800, height: 400 }],
      { x: 100, y: 100 },
    );
    expect(layouts[0]).toMatchObject({ width: 800, height: 400, x: 100, y: 100 });
  });
});
