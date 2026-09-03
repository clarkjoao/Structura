import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { applyLayoutResultEdges } from "./applyLayoutResult";
import { layout } from "./layoutEngine";
import { irToLayoutGraph } from "@/features/llm/ir/ir-to-layout-graph";
import { REFERENCE_DIAGRAMS } from "./reference-diagrams";
import { useDiagramStore } from "@/features/diagram";

/** Diagonal route for an edge: three points so interiorWaypoints returns one. */
function makeResult(graph: {
  nodes: Array<{ id: string }>;
  edges: Array<{ id: string; sourceId: string; targetId: string }>;
}) {
  return {
    boxes: new Map(graph.nodes.map((n) => [n.id, { x: 0, y: 0, width: 180, height: 80 }])),
    edgeRoutes: new Map(
      graph.edges.map((e) => [
        e.id,
        [
          { x: 100, y: 100 },
          { x: 200, y: 200 },
          { x: 300, y: 300 },
        ],
      ]),
    ),
    handleOrder: {
      outgoing: new Map<string, string[]>(),
      incoming: new Map<string, string[]>(),
    },
    bounds: { x: 0, y: 0, width: 400, height: 400 },
  };
}

/** A fake store that records calls for assertions. */
function makeFakeStore(diagramId: string) {
  const handleOrders: Array<{ componentId: string; side: string; ids: string[] }> = [];
  const waypoints: Array<{
    connectionId: string;
    points: Array<{ id: string; x: number; y: number }>;
  }> = [];
  const resets: string[] = [];
  const nodeLayouts: Record<string, Record<string, unknown>> = {};

  const store = {
    getState: () => ({
      activeDiagramId: diagramId,
      diagrams: {
        [diagramId]: {
          nodeLayouts,
          edgeLayouts: {} as Record<
            string,
            { points: Array<{ id: string; x: number; y: number }> }
          >,
        },
      },
    }),
    updateHandleOrder: vi.fn((componentId: string, side: string, ids: string[]) => {
      handleOrders.push({ componentId, side, ids });
    }),
    setEdgeControlPoints: vi.fn(
      (
        _diagramId: string,
        connectionId: string,
        points: Array<{ id: string; x: number; y: number }>,
        _opts?: unknown,
      ) => {
        waypoints.push({ connectionId, points });
      },
    ),
    resetEdgeControlPoints: vi.fn((_diagramId: string, connectionId: string) => {
      resets.push(connectionId);
    }),
    // For test assertions
    _handleOrders: handleOrders,
    _waypoints: waypoints,
    _resets: resets,
    _nodeLayouts: nodeLayouts,
  };

  return store;
}

describe("applyLayoutResultEdges", () => {
  let fakeStore: ReturnType<typeof makeFakeStore>;
  let diagramId: string;

  beforeEach(() => {
    diagramId = "diag-1";
    fakeStore = makeFakeStore(diagramId);
    vi.spyOn(useDiagramStore, "getState").mockReturnValue(
      fakeStore as unknown as ReturnType<typeof useDiagramStore.getState>,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns immediately when diagramId is null", () => {
    const graph = {
      nodes: [{ id: "a" }],
      edges: [{ id: "e1", sourceId: "a", targetId: "a" }],
    };
    const result = makeResult(graph);
    // Should not throw
    applyLayoutResultEdges(
      graph as unknown as Parameters<typeof applyLayoutResultEdges>[0],
      result,
      null,
    );
    expect(fakeStore.updateHandleOrder).not.toHaveBeenCalled();
  });

  it("writes handle order for nodes that have it", () => {
    const graph = {
      nodes: [{ id: "a" }, { id: "b" }],
      edges: [{ id: "e1", sourceId: "a", targetId: "b" }],
    };
    const result = makeResult(graph);
    result.handleOrder.outgoing.set("a", ["e1"]);
    result.handleOrder.incoming.set("b", ["e1"]);

    applyLayoutResultEdges(
      graph as unknown as Parameters<typeof applyLayoutResultEdges>[0],
      result,
      diagramId,
    );

    expect(fakeStore.updateHandleOrder).toHaveBeenCalledWith("a", "outgoing", ["e1"]);
    expect(fakeStore.updateHandleOrder).toHaveBeenCalledWith("b", "incoming", ["e1"]);
  });

  it("resets waypoints before writing new ones", () => {
    const graph = {
      nodes: [{ id: "a" }, { id: "b" }],
      edges: [{ id: "e1", sourceId: "a", targetId: "b" }],
    };
    const result = makeResult(graph);

    applyLayoutResultEdges(
      graph as unknown as Parameters<typeof applyLayoutResultEdges>[0],
      result,
      diagramId,
    );

    expect(fakeStore.resetEdgeControlPoints).toHaveBeenCalledWith(diagramId, "e1");
    expect(fakeStore.setEdgeControlPoints).toHaveBeenCalled();
  });

  it("writes waypoints for all edges in the graph", () => {
    const graph = {
      nodes: [{ id: "a" }, { id: "b" }],
      edges: [{ id: "e1", sourceId: "a", targetId: "b" }],
    };
    const result = makeResult(graph);

    applyLayoutResultEdges(
      graph as unknown as Parameters<typeof applyLayoutResultEdges>[0],
      result,
      diagramId,
    );

    expect(fakeStore._waypoints).toHaveLength(1);
    expect(fakeStore._waypoints[0].connectionId).toBe("e1");
  });

  it("does not write waypoints for edges with two or fewer route points", () => {
    const graph = {
      nodes: [{ id: "a" }, { id: "b" }],
      edges: [{ id: "e1", sourceId: "a", targetId: "b" }],
    };
    const result = makeResult(graph);
    // Two-point route: no interior waypoints
    result.edgeRoutes.set("e1", [
      { x: 0, y: 0 },
      { x: 100, y: 100 },
    ]);

    applyLayoutResultEdges(
      graph as unknown as Parameters<typeof applyLayoutResultEdges>[0],
      result,
      diagramId,
    );

    expect(fakeStore._resets).toContain("e1"); // reset happens
    expect(fakeStore._waypoints.find((w) => w.connectionId === "e1")).toBeUndefined(); // no new waypoints written
  });

  it("applies waypointOffset to the written coordinates", () => {
    const graph = {
      nodes: [{ id: "a" }, { id: "b" }],
      edges: [{ id: "e1", sourceId: "a", targetId: "b" }],
    };
    const result = makeResult(graph);
    const OFFSET = { x: 500, y: 300 };

    applyLayoutResultEdges(
      graph as unknown as Parameters<typeof applyLayoutResultEdges>[0],
      result,
      diagramId,
      { waypointOffset: OFFSET },
    );

    const wp = fakeStore._waypoints.find((w) => w.connectionId === "e1")!;
    // The single interior point (200,200) is shifted by the offset
    expect(wp.points[0].x).toBe(200 + OFFSET.x);
    expect(wp.points[0].y).toBe(200 + OFFSET.y);
  });

  it("only writes waypoints for edges in the edgeIds filter", () => {
    const graph = {
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
      edges: [
        { id: "e1", sourceId: "a", targetId: "b" },
        { id: "e2", sourceId: "b", targetId: "c" },
      ],
    };
    const result = makeResult(graph);

    applyLayoutResultEdges(
      graph as unknown as Parameters<typeof applyLayoutResultEdges>[0],
      result,
      diagramId,
      { edgeIds: new Set(["e1"]) },
    );

    // e1 is reset and rewritten
    expect(fakeStore._resets).toContain("e1");
    expect(fakeStore._waypoints.find((w) => w.connectionId === "e1")).toBeDefined();
    // e2 is NOT reset
    expect(fakeStore._resets).not.toContain("e2");
  });
});

/**
 * Integration smoke test: `applyLayoutResultEdges` on a real layout result from
 * ELK, over one of the reference diagrams.  This exercises the real handle order
 * and waypoint paths, confirming the function composes correctly with the engine.
 */
describe("applyLayoutResultEdges — integration with layout()", () => {
  let fakeStore: ReturnType<typeof makeFakeStore>;
  let diagramId: string;

  beforeEach(() => {
    diagramId = "diag-integration";
    fakeStore = makeFakeStore(diagramId);
    vi.spyOn(useDiagramStore, "getState").mockReturnValue(
      fakeStore as unknown as ReturnType<typeof useDiagramStore.getState>,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes handle order for every node in a real layout result", async () => {
    const { ir } = REFERENCE_DIAGRAMS[0];
    const graph = irToLayoutGraph(ir);
    const result = await layout(graph);

    applyLayoutResultEdges(graph, result, diagramId);

    expect(fakeStore.updateHandleOrder).toHaveBeenCalled();
    expect(fakeStore._handleOrders.length).toBeGreaterThan(0);
  });

  it("writes waypoints for edges that have bend points in a real layout", async () => {
    const { ir } = REFERENCE_DIAGRAMS[0];
    const graph = irToLayoutGraph(ir);
    const result = await layout(graph);

    applyLayoutResultEdges(graph, result, diagramId);

    expect(fakeStore._waypoints.length).toBeGreaterThan(0);
  });

  it("the offset shift is applied to real waypoints without affecting handle order", async () => {
    const { ir } = REFERENCE_DIAGRAMS[0];
    const graph = irToLayoutGraph(ir);
    const result = await layout(graph);

    const OFFSET = { x: 1000, y: 500 };
    applyLayoutResultEdges(graph, result, diagramId, { waypointOffset: OFFSET });

    for (const wp of fakeStore._waypoints) {
      for (const pt of wp.points) {
        expect(pt.x).toBeGreaterThan(OFFSET.x);
        expect(pt.y).toBeGreaterThan(OFFSET.y);
      }
    }
  });
});
