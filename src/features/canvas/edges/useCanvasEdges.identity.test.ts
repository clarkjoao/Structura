import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Connection, Diagram } from "@/features/diagram";
import { useCanvasEdges } from "./useCanvasEdges";

/**
 * useCanvasNodes keeps a per-node identity cache so a store change that touches
 * one node does not hand React Flow 400 new node objects. useCanvasEdges had no
 * equivalent: any dependency change rebuilt every Edge object, so moving a
 * single node remounted the whole edge layer.
 *
 * A drag frame never triggers this -- the store is frozen for the length of a
 * gesture -- but the commit does, and so does every other store write.
 */
const EDGE_COUNT = 30;

function buildDiagram(nodeLayoutsVersion: number): {
  diagram: Diagram;
  connections: Connection[];
  assignments: { connId: string; sourceHandle: string; targetHandle: string }[];
} {
  const components: Record<string, unknown> = {};
  const connections: Record<string, unknown> = {};
  const nodeLayouts: Record<string, unknown> = {};
  const list: Connection[] = [];
  const assignments: { connId: string; sourceHandle: string; targetHandle: string }[] = [];

  for (let i = 0; i <= EDGE_COUNT; i++) {
    const id = `n-${i}`;
    components[id] = { id, name: id, type: "container", parentId: null };
    // only the first node "moves" between versions
    nodeLayouts[id] = { elementId: id, x: i === 0 ? nodeLayoutsVersion : i * 10, y: 0 };
  }
  for (let i = 0; i < EDGE_COUNT; i++) {
    const id = `c-${i}`;
    const conn = {
      id,
      sourceId: `n-${i}`,
      targetId: `n-${i + 1}`,
      label: `call ${i}`,
      style: { edgeStyle: "editable-step" },
    } as unknown as Connection;
    connections[id] = conn;
    list.push(conn);
    assignments.push({ connId: id, sourceHandle: `source-${i}`, targetHandle: `target-${i}` });
  }

  const diagram = {
    id: "edge-identity-diagram",
    name: "edges",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components, connections, flows: {}, iconLibrary: {} },
    nodeLayouts,
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    folderId: null,
  } as unknown as Diagram;

  return { diagram, connections: list, assignments };
}

const EMPTY_HIGHLIGHT = {
  activeConnId: null,
  participantConnIds: new Set<string>(),
  openFrameConnIds: new Set<string>(),
};

function params(
  diagram: Diagram,
  connections: Connection[],
  assignments: { connId: string; sourceHandle: string; targetHandle: string }[],
  selectedEdgeId: string | null = null,
) {
  return {
    diagram,
    visibleConnections: connections,
    edgeHandleAssignments: assignments,
    selectedEdgeId,
    isPlaying: false,
    isCompareMode: false,
    compareConnectionOpacity: undefined,
    activeStep: null,
    flowHighlight: EMPTY_HIGHLIGHT,
    flowBadges: null,
    coverage: null,
    visibleTags: null,
    visibleTagsKey: null,
  };
}

describe("useCanvasEdges identity", () => {
  it("keeps every edge object when a node moves", () => {
    const first = buildDiagram(0);
    const { result, rerender } = renderHook((p: ReturnType<typeof params>) => useCanvasEdges(p), {
      initialProps: params(first.diagram, first.connections, first.assignments),
    });
    const before = result.current;
    expect(before).toHaveLength(EDGE_COUNT);

    // a node moved: new diagram object, new nodeLayouts, same connections
    const second = buildDiagram(999);
    second.diagram.id = first.diagram.id;
    rerender(params(second.diagram, first.connections, first.assignments));

    const after = result.current;
    expect(after).toHaveLength(EDGE_COUNT);
    const changed = after.filter((edge, i) => edge !== before[i]);
    expect(changed).toHaveLength(0);
    // and the array itself is the same, so React Flow's store is not rewritten
    expect(after).toBe(before);
  });

  it("replaces only the edge whose selection changed", () => {
    const first = buildDiagram(0);
    const { result, rerender } = renderHook((p: ReturnType<typeof params>) => useCanvasEdges(p), {
      initialProps: params(first.diagram, first.connections, first.assignments),
    });
    const before = [...result.current];

    rerender(params(first.diagram, first.connections, first.assignments, "c-7"));

    const after = result.current;
    const changed = after.filter((edge, i) => edge !== before[i]).map((e) => e.id);
    expect(changed).toEqual(["c-7"]);
    expect(after.find((e) => e.id === "c-7")?.selected).toBe(true);
  });

  it("replaces the array when an edge disappears", () => {
    const first = buildDiagram(0);
    const { result, rerender } = renderHook((p: ReturnType<typeof params>) => useCanvasEdges(p), {
      initialProps: params(first.diagram, first.connections, first.assignments),
    });
    const before = result.current;

    const fewer = first.connections.slice(0, EDGE_COUNT - 1);
    rerender(params(first.diagram, fewer, first.assignments));

    expect(result.current).toHaveLength(EDGE_COUNT - 1);
    expect(result.current).not.toBe(before);
    // the survivors keep their identity
    for (let i = 0; i < EDGE_COUNT - 1; i++) {
      expect(result.current[i]).toBe(before[i]);
    }
  });
});
