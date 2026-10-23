import { describe, expect, it } from "vitest";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import { PANEL_COLLAPSED_H, PANEL_COLLAPSED_W } from "@/features/diagram/model/layout.constants";
import { fitToContentIds, fromDiagram, resizableIds } from "./fromDiagram";
import { planDiagramAutoLayout } from "./autoLayoutDiagram";

/**
 * A collapsed panel takes part in the layout the way the canvas draws it: a leaf
 * at its collapsed size, with its hidden children left where they are. Before,
 * ELK was handed the children, sized the panel to hold them, and its neighbours
 * kept their distance from a box the canvas did not draw.
 */

const component = (
  id: string,
  parentId: string | null,
  type: Component["type"] = "container",
  extra: Record<string, unknown> = {},
): Component => ({ id, name: id, description: "", parentId, type, ...extra }) as Component;

const connection = (id: string, sourceId: string, targetId: string): Connection =>
  ({ id, sourceId, targetId, label: "" }) as Connection;

function componentsOf(list: Component[]): Record<string, Component> {
  return Object.fromEntries(list.map((c) => [c.id, c]));
}

const EXPANDED = { width: 900, height: 500 };

function collapsedPanelDiagram() {
  const components = componentsOf([
    component("panel", null, "panel", {
      collapsed: true,
      collapsedWidth: EXPANDED.width,
      collapsedHeight: EXPANDED.height,
    }),
    component("inner", "panel"),
    component("nested", "panel", "panel"),
    component("deep", "nested"),
    component("outside", null),
  ]);
  const nodeLayouts: Record<string, NodeLayout> = {
    panel: { elementId: "panel", x: 0, y: 0, width: PANEL_COLLAPSED_W, height: PANEL_COLLAPSED_H },
    inner: { elementId: "inner", x: 37, y: 61 },
    nested: { elementId: "nested", x: 300, y: 80, width: 400, height: 300 },
    deep: { elementId: "deep", x: 12, y: 34 },
    outside: { elementId: "outside", x: 2000, y: 0 },
  } as Record<string, NodeLayout>;
  const connections = [
    connection("c-in", "outside", "inner"),
    connection("c-panel", "panel", "outside"),
  ];
  return { components, nodeLayouts, connections };
}

describe("fromDiagram with a collapsed panel", () => {
  it("enters the panel as a leaf at its collapsed size, without its descendants", () => {
    const { components, nodeLayouts, connections } = collapsedPanelDiagram();
    const graph = fromDiagram(components, connections, nodeLayouts);

    expect(graph.nodes.map((node) => node.id).sort()).toEqual(["outside", "panel"]);
    const panel = graph.nodes.find((node) => node.id === "panel")!;
    expect({ width: panel.width, height: panel.height }).toEqual({
      width: PANEL_COLLAPSED_W,
      height: PANEL_COLLAPSED_H,
    });
  });

  it("drops the edges to a hidden element and keeps the ones to the panel", () => {
    const { components, nodeLayouts, connections } = collapsedPanelDiagram();
    const graph = fromDiagram(components, connections, nodeLayouts);

    expect(graph.edges.map((edge) => edge.id)).toEqual(["c-panel"]);
  });

  it("leaves the descendants out of a scoped layout rooted at the panel", () => {
    const { components, nodeLayouts, connections } = collapsedPanelDiagram();
    const graph = fromDiagram(components, connections, nodeLayouts, { rootIds: ["panel"] });

    expect(graph.nodes.map((node) => node.id)).toEqual(["panel"]);
  });

  it("never writes a size back to a collapsed panel", () => {
    const { components, nodeLayouts, connections } = collapsedPanelDiagram();
    const graph = fromDiagram(components, connections, nodeLayouts);

    expect(resizableIds(graph, components).has("panel")).toBe(false);
    expect(fitToContentIds(graph, components).has("panel")).toBe(false);
  });
});

describe("planDiagramAutoLayout with a collapsed panel", () => {
  it("moves the panel and leaves its descendants and expanded size alone", async () => {
    const { components, nodeLayouts, connections } = collapsedPanelDiagram();
    const plan = await planDiagramAutoLayout({
      components,
      connections,
      nodeLayouts,
      autoRefs: false,
    });

    const ids = plan.layouts.map((entry) => entry.elementId).sort();
    expect(ids).toEqual(["outside", "panel"]);
    const panel = plan.layouts.find((entry) => entry.elementId === "panel")!;
    expect(panel.width).toBeUndefined();
    expect(panel.height).toBeUndefined();
    // The size it opens to lives on the component, which the plan never touches.
    const stored = components.panel as Component & { collapsedWidth?: number };
    expect(stored.collapsedWidth).toBe(EXPANDED.width);
  });

  it("places neighbours against the collapsed size, not the expanded one", async () => {
    const { components, nodeLayouts, connections } = collapsedPanelDiagram();
    const plan = await planDiagramAutoLayout({
      components,
      connections,
      nodeLayouts,
      autoRefs: false,
    });

    const panel = plan.layouts.find((entry) => entry.elementId === "panel")!;
    const outside = plan.layouts.find((entry) => entry.elementId === "outside")!;
    // `panel -> outside`, so `outside` is the next layer to the right; the gap is
    // measured from the collapsed box.
    expect(outside.x - (panel.x + PANEL_COLLAPSED_W)).toBeLessThan(EXPANDED.width);
  });
});
