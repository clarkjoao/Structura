import { describe, expect, it } from "vitest";
import type { Component, Diagram } from "@/features/diagram";
import { exportDrawio } from "./export-drawio";

function withText(textsVisible?: boolean): Diagram {
  const text = {
    id: "t",
    name: "Phase 1: discovery",
    description: "",
    parentId: null,
    type: "text",
  } as Component;
  return {
    id: "d1",
    name: "Plan",
    level: "context",
    createdAt: 1,
    updatedAt: 1,
    snapshot: { components: { t: text }, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: { t: { elementId: "t", x: 10, y: 20, width: 280, height: 48 } },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    ...(textsVisible === undefined ? {} : { textsVisible }),
  } as Diagram;
}

describe("draw.io export and the text layer", () => {
  it("leaves the texts out while the layer is off", () => {
    expect(exportDrawio(withText(), {})).not.toContain("Phase 1: discovery");
  });

  it("exports them, as a cell that keeps their type, while the layer is on", () => {
    const xml = exportDrawio(withText(true), {});
    expect(xml).toContain("Phase 1: discovery");
    expect(xml).toContain("text");
  });
});
