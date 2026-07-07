import { describe, expect, it } from "vitest";
import { migrateEdgeWaypointsToPoints } from "./persist.config";
import type { DiagramStore } from "./store.types";

/** Minimal persisted-shape factory: a single diagram with the given edgeLayouts blob. */
function stateWithEdgeLayouts(edgeLayouts: unknown): Partial<DiagramStore> {
  return {
    diagrams: {
      d1: { edgeLayouts } as never,
    },
  } as Partial<DiagramStore>;
}

function edgeLayoutsOf(state: Partial<DiagramStore>): Record<string, Record<string, unknown>> {
  return (
    state.diagrams as unknown as Record<
      string,
      { edgeLayouts: Record<string, Record<string, unknown>> }
    >
  ).d1.edgeLayouts;
}

describe("migrateEdgeWaypointsToPoints", () => {
  it("converts legacy waypoints into control points with generated ids and equivalent geometry", () => {
    const state = stateWithEdgeLayouts({
      "edge-a": {
        waypoints: [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ],
        labelOffset: 0.25,
      },
    });

    migrateEdgeWaypointsToPoints(state);

    const layout = edgeLayoutsOf(state)["edge-a"];
    expect(layout.waypoints).toBeUndefined();
    expect(layout.labelOffset).toBe(0.25);
    const points = layout.points as Array<{ id: string; x: number; y: number }>;
    expect(points).toHaveLength(2);
    expect(points.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: 10, y: 20 },
      { x: 30, y: 40 },
    ]);
    expect(points[0].id).toBeTruthy();
    expect(points[1].id).toBeTruthy();
    expect(points[0].id).not.toBe(points[1].id);
  });

  it("is idempotent: ids stay stable and waypoints are not reintroduced on a second run", () => {
    const state = stateWithEdgeLayouts({
      "edge-a": { waypoints: [{ x: 1, y: 2 }] },
    });

    migrateEdgeWaypointsToPoints(state);
    const firstIds = (edgeLayoutsOf(state)["edge-a"].points as Array<{ id: string }>).map(
      (p) => p.id,
    );

    migrateEdgeWaypointsToPoints(state);
    const layout = edgeLayoutsOf(state)["edge-a"];
    const secondIds = (layout.points as Array<{ id: string }>).map((p) => p.id);

    expect(layout.waypoints).toBeUndefined();
    expect(secondIds).toEqual(firstIds);
  });

  it("leaves already-migrated point layouts untouched (but drops stray waypoints)", () => {
    const state = stateWithEdgeLayouts({
      "edge-a": { points: [{ id: "keep", x: 5, y: 6 }], waypoints: [{ x: 99, y: 99 }] },
    });

    migrateEdgeWaypointsToPoints(state);

    const layout = edgeLayoutsOf(state)["edge-a"];
    expect(layout.waypoints).toBeUndefined();
    expect(layout.points).toEqual([{ id: "keep", x: 5, y: 6 }]);
  });

  it("tolerates missing or empty edgeLayouts", () => {
    const empty = stateWithEdgeLayouts({});
    expect(() => migrateEdgeWaypointsToPoints(empty)).not.toThrow();
    expect(() => migrateEdgeWaypointsToPoints({ diagrams: {} })).not.toThrow();
    expect(() => migrateEdgeWaypointsToPoints({})).not.toThrow();
  });
});
