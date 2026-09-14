import { describe, expect, it } from "vitest";
import type { Component, Connection, Diagram } from "@/features/diagram";
import "@/features/canvas/nodes/node-types/registry";
import { DIAGRAM_EDGE_RF_TYPE } from "./reactFlowBaseConfig";
import { projectReadDiagram } from "./projectReadDiagram";

function component(partial: Record<string, unknown>): Component {
  return { description: "", parentId: null, ...partial } as unknown as Component;
}

function connection(id: string, sourceId: string, targetId: string): Connection {
  return { id, sourceId, targetId, label: "" };
}

function diagramOf(components: Component[], connections: Connection[] = []): Diagram {
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
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe("projectReadDiagram", () => {
  it("locks nodes and uses the shared editable edge type", () => {
    const diagram = diagramOf(
      [
        component({ id: "a", name: "A", type: "system" }),
        component({ id: "b", name: "B", type: "system" }),
      ],
      [connection("e1", "a", "b")],
    );
    const { nodes, edges } = projectReadDiagram(diagram);
    expect(nodes).toHaveLength(2);
    expect(nodes.every((node) => node.draggable === false)).toBe(true);
    expect(nodes.every((node) => node.data.controlsDisabled === true)).toBe(true);
    expect(edges).toHaveLength(1);
    expect(edges[0]?.type).toBe(DIAGRAM_EDGE_RF_TYPE);
    expect(edges[0]?.selectable).toBe(false);
  });
});
