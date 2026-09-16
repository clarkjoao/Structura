import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyLayoutResultEdges } from "./applyLayoutResult";
import { useDiagramStore } from "@/features/diagram";

/**
 * `resetPaths` clears every participating edge's control points and stops
 * before writing bend points — for callers that want an untouched mid-X Z.
 *
 * The default (option absent) writes handle-aligned ELK corridors instead.
 * Auto-layout / panel-child layout use that default; this file only locks the
 * opt-out behaviour.
 *
 * Expressed as an option rather than by calling the reset helper afterwards,
 * because writing every waypoint and deleting it again is two store writes per
 * edge — and every `set()` serialises the whole workspace for the persist
 * middleware (see AGENTS.md).
 */

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

function makeFakeStore(diagramId: string) {
  const waypoints: string[] = [];
  const resets: string[] = [];
  const handleOrders: Array<{ componentId: string; side: string; ids: string[] }> = [];

  return {
    getState: () => ({ activeDiagramId: diagramId, diagrams: { [diagramId]: {} } }),
    updateHandleOrder: vi.fn((componentId: string, side: string, ids: string[]) => {
      handleOrders.push({ componentId, side, ids });
    }),
    setEdgeControlPoints: vi.fn((_d: string, connectionId: string) => {
      waypoints.push(connectionId);
    }),
    resetEdgeControlPoints: vi.fn((_d: string, connectionId: string) => {
      resets.push(connectionId);
    }),
    _waypoints: waypoints,
    _resets: resets,
    _handleOrders: handleOrders,
  };
}

const GRAPH = {
  nodes: [{ id: "a" }, { id: "b" }],
  edges: [{ id: "e1", sourceId: "a", targetId: "b" }],
};

describe("applyLayoutResultEdges with resetPaths", () => {
  let fakeStore: ReturnType<typeof makeFakeStore>;
  const diagramId = "diag-1";

  beforeEach(() => {
    fakeStore = makeFakeStore(diagramId);
    vi.spyOn(useDiagramStore, "getState").mockReturnValue(
      fakeStore as unknown as ReturnType<typeof useDiagramStore.getState>,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function run(options?: { resetPaths?: boolean }) {
    const result = makeResult(GRAPH);
    result.handleOrder.outgoing.set("a", ["e1"]);
    result.handleOrder.incoming.set("b", ["e1"]);
    applyLayoutResultEdges(
      GRAPH as unknown as Parameters<typeof applyLayoutResultEdges>[0],
      result,
      diagramId,
      options,
    );
  }

  it("clears the paths and writes no bend points back", () => {
    run({ resetPaths: true });

    expect(fakeStore._resets).toEqual(["e1"]);
    expect(fakeStore._waypoints).toEqual([]);
    expect(fakeStore.setEdgeControlPoints).not.toHaveBeenCalled();
  });

  /**
   * The handle ordering is not a path. ELK sorts the edges along each node's
   * border to reduce crossings, and dropping that would undo most of what the
   * layout achieved — it is worth roughly 3x the rendered crossings on the
   * reference diagrams.
   */
  it("still writes the handle order ELK worked out", () => {
    run({ resetPaths: true });

    expect(fakeStore.updateHandleOrder).toHaveBeenCalledWith("a", "outgoing", ["e1"]);
    expect(fakeStore.updateHandleOrder).toHaveBeenCalledWith("b", "incoming", ["e1"]);
  });

  /** Default path: handle-aligned corridors are written. */
  it("keeps writing bend points when the option is absent", () => {
    run();

    expect(fakeStore._resets).toEqual(["e1"]);
    expect(fakeStore._waypoints).toEqual(["e1"]);
  });

  /**
   * The scoped case, which is what "Organize children (LR)" runs: only the
   * edges the layout owns are touched, and those end with no path either.
   */
  it("resets only the edges in scope, and writes no bend points for them", () => {
    const graph = {
      nodes: [{ id: "a" }, { id: "b" }, { id: "c" }],
      edges: [
        { id: "e1", sourceId: "a", targetId: "b" },
        { id: "outside", sourceId: "b", targetId: "c" },
      ],
    };
    const result = makeResult(graph);

    applyLayoutResultEdges(
      graph as unknown as Parameters<typeof applyLayoutResultEdges>[0],
      result,
      diagramId,
      { resetPaths: true, edgeIds: new Set(["e1"]) },
    );

    expect(fakeStore._resets).toEqual(["e1"]);
    expect(fakeStore._waypoints).toEqual([]);
  });
});
