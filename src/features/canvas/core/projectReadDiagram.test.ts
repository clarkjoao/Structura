import { describe, expect, it } from "vitest";
import type { Component, Connection, Diagram } from "@/features/diagram";
import "@/features/canvas/nodes/node-types/registry";
import { DIAGRAM_EDGE_RF_TYPE } from "./reactFlowBaseConfig";
import { projectReadDiagram } from "./projectReadDiagram";
import type { EdgeData } from "../edges/data/edgeData.types";

function component(partial: Record<string, unknown>): Component {
  return { description: "", parentId: null, ...partial } as unknown as Component;
}

function connection(id: string, sourceId: string, targetId: string): Connection {
  return { id, sourceId, targetId, label: "" };
}

function diagramOf(
  components: Component[],
  connections: Connection[] = [],
  edgeLayouts: Diagram["edgeLayouts"] = {},
): Diagram {
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
    edgeLayouts,
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

  it("stamps edgeLayouts points and labelOffset onto edge data for the viewer", () => {
    const diagram = diagramOf(
      [
        component({ id: "a", name: "A", type: "system" }),
        component({ id: "b", name: "B", type: "system" }),
      ],
      [connection("e1", "a", "b")],
      {
        e1: {
          points: [
            { id: "cp1", x: 40, y: 10 },
            { id: "cp2", x: 40, y: 90 },
          ],
          labelOffset: 0.35,
        },
      },
    );
    const { edges } = projectReadDiagram(diagram);
    const data = edges[0]?.data as EdgeData;
    expect(data.layoutPoints).toEqual([
      { id: "cp1", x: 40, y: 10 },
      { id: "cp2", x: 40, y: 90 },
    ]);
    expect(data.layoutLabelOffset).toBe(0.35);
  });

  it("stamps neutral values when the connection has no edgeLayouts entry", () => {
    // An unstamped edge fell back to the store's active diagram — the reader's
    // own workspace, not the shared one.
    const diagram = diagramOf(
      [
        component({ id: "a", name: "A", type: "system" }),
        component({ id: "b", name: "B", type: "system" }),
      ],
      [connection("e1", "a", "b")],
    );
    const { edges } = projectReadDiagram(diagram);
    const data = edges[0]?.data as EdgeData;
    expect(data.layoutPoints).toEqual([]);
    expect(data.layoutLabelOffset).toBeNull();
  });

  it("stamps every edge even when the payload has no edgeLayouts at all", () => {
    const diagram = diagramOf(
      [
        component({ id: "a", name: "A", type: "system" }),
        component({ id: "b", name: "B", type: "system" }),
      ],
      [connection("e1", "a", "b")],
    );
    const legacy = { ...diagram, edgeLayouts: undefined } as unknown as Diagram;
    const data = projectReadDiagram(legacy).edges[0]?.data as EdgeData;
    expect(data.layoutPoints).toEqual([]);
    expect(data.layoutLabelOffset).toBeNull();
  });
});
