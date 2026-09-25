import { describe, expect, it } from "vitest";
import { paletteEntriesForCategory } from "@/features/elements/element.palette";
import { getElement } from "@/features/elements/element.registry";

describe("flow-divider", () => {
  const descriptor = getElement("flow-divider")!;
  const base = { id: "l", name: "Line", description: "", parentId: null };

  it("is offered as the three service-blueprint lines", () => {
    const entries = paletteEntriesForCategory("canvas").filter((e) => e.type === "flow-divider");
    expect(entries.map((e) => e.key).sort()).toEqual([
      "flow-divider:interaction",
      "flow-divider:internal",
      "flow-divider:visibility",
    ]);
  });

  it("starts the line of visibility dashed and stores nothing for solid", () => {
    expect(descriptor.model.createComponent(base, { stroke: "dashed" })).toMatchObject({
      stroke: "dashed",
    });
    expect(descriptor.model.createComponent(base, {})).not.toHaveProperty("stroke");
  });

  it("resizes in width only: its height is the label chip's", () => {
    const style = descriptor.canvas.buildStyle!(
      { ...base, type: "flow-divider" } as never,
      {
        resolvedNodeLayouts: { l: { elementId: "l", x: 0, y: 0, width: 1200, height: 300 } },
      } as never,
    );
    expect(style).toEqual({ width: 1200, height: 24 });
  });

  it("is not connectable", () => {
    expect(descriptor.canvas.connectable).toBe(false);
  });
});
