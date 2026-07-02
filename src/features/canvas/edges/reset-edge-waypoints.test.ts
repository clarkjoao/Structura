import { describe, expect, it } from "vitest";
import { collectConnectionIdsToResetWaypoints } from "./reset-edge-waypoints";

describe("collectConnectionIdsToResetWaypoints", () => {
  it("returns selected React Flow edges when any edge is selected", () => {
    const ids = collectConnectionIdsToResetWaypoints({
      edgeLayouts: {},
      selectedEdgeId: "fallback",
      reactFlowEdges: [{ id: "a", selected: true } as never, { id: "b", selected: false } as never],
    });
    expect(ids).toEqual(["a"]);
  });

  it("falls back to selectedEdgeId when no React Flow edge is selected", () => {
    const ids = collectConnectionIdsToResetWaypoints({
      edgeLayouts: {},
      selectedEdgeId: "edge-1",
      reactFlowEdges: [{ id: "edge-2", selected: false } as never],
    });
    expect(ids).toEqual(["edge-1"]);
  });

  it("returns all connections with waypoints when nothing is selected", () => {
    const ids = collectConnectionIdsToResetWaypoints({
      edgeLayouts: {
        "edge-a": { waypoints: [{ x: 1, y: 2 }] },
        "edge-b": { waypoints: [] },
        "edge-c": { waypoints: [{ x: 3, y: 4 }], labelOffset: 0.5 },
      },
      selectedEdgeId: null,
      reactFlowEdges: [],
    });
    expect(ids).toEqual(["edge-a", "edge-c"]);
  });
});
