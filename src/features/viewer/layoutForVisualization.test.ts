import { describe, expect, it } from "vitest";
import type { Component, Connection, Diagram } from "@/features/diagram";
import { layoutForVisualization } from "./layoutForVisualization";

function component(partial: Record<string, unknown>): Component {
  return { description: "", parentId: null, ...partial } as unknown as Component;
}

function connection(id: string, sourceId: string, targetId: string): Connection {
  return { id, sourceId, targetId, label: "" };
}

function diagramOf(components: Component[], connections: Connection[]): Diagram {
  return {
    id: "d1",
    name: "Viewed",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: {
      components: Object.fromEntries(components.map((c) => [c.id, c])),
      connections: Object.fromEntries(connections.map((c) => [c.id, c])),
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {
      a: { elementId: "a", x: 0, y: 0, width: 180, height: 80 },
      b: { elementId: "b", x: 300, y: 0, width: 180, height: 80 },
    },
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe("layoutForVisualization", () => {
  it("writes handle-aligned edgeLayouts onto the immutable copy", async () => {
    const source = diagramOf(
      [
        component({ id: "a", name: "A", type: "system" }),
        component({ id: "b", name: "B", type: "system" }),
      ],
      [connection("e1", "a", "b")],
    );
    const arranged = await layoutForVisualization(source);
    expect(arranged).not.toBe(source);
    const points = arranged.edgeLayouts.e1?.points ?? [];
    expect(points.length).toBeGreaterThan(0);
    expect(source.edgeLayouts).toEqual({});
  });
});
