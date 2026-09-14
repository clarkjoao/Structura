import { describe, expect, it } from "vitest";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import { layoutScopedNodes } from "./layoutScopedNodes";
import type { AppliedLayout } from "./applyLayout";

/**
 * A panel keeps its size unless the layout saw all of its children.
 *
 * ELK sizes a container from the children it is given. Lay out a selection that
 * holds a panel and only two of its seven children, and ELK sizes the panel to
 * fit those two — so the other five end up outside their own panel, which is
 * the exact failure `fromDiagram`'s `resizableIds` comment exists to prevent,
 * arriving from the other direction.
 *
 * Measured in the browser before this guard: selecting a panel and two of its
 * children took the panel from 1980x478 to 340x378, leaving five children with
 * x as far as 1940 sitting outside a 340-wide box.
 *
 * Writing no size is the safe answer, not a compromise: the panel already holds
 * its children at the size it has, and the layout is not being asked to change
 * what it could not see.
 */

const PANEL_W = 900;
const PANEL_H = 600;

function component(id: string, type: string, parentId: string | null): Component {
  return { id, name: id, type, parentId } as unknown as Component;
}

/** A panel with three children, of which `scoped` are laid out. */
function run(scoped: string[]): Promise<AppliedLayout[]> {
  const components: Record<string, Component> = {
    panel: component("panel", "panel", null),
    a: component("a", "system", "panel"),
    b: component("b", "system", "panel"),
    c: component("c", "system", "panel"),
  };
  const connections: Record<string, Connection> = {
    e1: { id: "e1", sourceId: "a", targetId: "b" } as unknown as Connection,
  };
  const nodeLayouts: Record<string, NodeLayout> = {
    panel: { elementId: "panel", x: 0, y: 0, width: PANEL_W, height: PANEL_H },
    a: { elementId: "a", x: 20, y: 20, width: 180, height: 80 },
    b: { elementId: "b", x: 20, y: 200, width: 180, height: 80 },
    c: { elementId: "c", x: 20, y: 400, width: 180, height: 80 },
  };

  return new Promise((resolve) => {
    void layoutScopedNodes({
      nodeIds: scoped,
      connectionIds: ["e1"],
      components,
      connections,
      nodeLayouts,
      anchor: { x: 0, y: 0 },
      activeDiagramId: null,
      applyAutoLayout: (layouts) => resolve(layouts),
    });
  });
}

describe("a partially selected panel", () => {
  it("is not resized, so the children left out keep their home", async () => {
    const applied = await run(["panel", "a", "b"]);
    const panel = applied.find((entry) => entry.elementId === "panel")!;

    expect(panel.width).toBeUndefined();
    expect(panel.height).toBeUndefined();
  });

  it("is still moved — only its size is left alone", async () => {
    const applied = await run(["panel", "a", "b"]);
    expect(applied.find((entry) => entry.elementId === "panel")).toBeDefined();
  });

  it("is resized when every child was in the layout", async () => {
    const applied = await run(["panel", "a", "b", "c"]);
    const panel = applied.find((entry) => entry.elementId === "panel")!;

    expect(panel.width).toBeGreaterThan(0);
    expect(panel.height).toBeGreaterThan(0);
  });
});
