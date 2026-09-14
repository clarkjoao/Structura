import { describe, expect, it } from "vitest";
import type { Connection } from "@/features/diagram";
import { collectBoundaryConnectionIds } from "./reset-edge-waypoints";

/**
 * Laying out part of a diagram moves nodes that edges outside the selection
 * still point at.
 *
 * `fromDiagram` drops a connection unless **both** endpoints are in scope, so
 * an edge from a selected node to an unselected one never reaches ELK and never
 * reaches `applyLayoutResultEdges` either. Its stored control points survive
 * the layout and go on describing a path to where the node used to be — a
 * detour hanging off a node that moved.
 *
 * The edge itself stays attached: sides are fixed and the canvas redraws it
 * from the handles. It is only the stored path that goes stale, so clearing
 * exactly those is the fix.
 */

const connections: Connection[] = [
  { id: "inside", sourceId: "a", targetId: "b" },
  { id: "leaving", sourceId: "b", targetId: "outside" },
  { id: "arriving", sourceId: "outside", targetId: "a" },
  { id: "elsewhere", sourceId: "outside", targetId: "far" },
] as unknown as Connection[];

describe("collectBoundaryConnectionIds", () => {
  it("takes the connections with exactly one end in the selection", () => {
    const ids = collectBoundaryConnectionIds(connections, new Set(["a", "b"]));
    expect([...ids].sort()).toEqual(["arriving", "leaving"]);
  });

  it("leaves the ones wholly inside alone — the layout owns those", () => {
    const ids = collectBoundaryConnectionIds(connections, new Set(["a", "b"]));
    expect(ids).not.toContain("inside");
  });

  it("leaves the ones wholly outside alone — nothing moved under them", () => {
    const ids = collectBoundaryConnectionIds(connections, new Set(["a", "b"]));
    expect(ids).not.toContain("elsewhere");
  });

  it("finds nothing when the selection is the whole diagram", () => {
    const ids = collectBoundaryConnectionIds(connections, new Set(["a", "b", "outside", "far"]));
    expect(ids).toEqual([]);
  });

  it("finds nothing for an empty selection", () => {
    expect(collectBoundaryConnectionIds(connections, new Set())).toEqual([]);
  });
});
