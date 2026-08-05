import type { ReadabilityBox } from "./layoutReadability";

/**
 * A diagram whose nodes were placed by hand, not by ELK.
 *
 * The four reference diagrams in `reference-diagrams.ts` all go through the
 * layout engine, which arranges everything left to right. That makes them blind
 * to any change aimed at edges running against the flow — measuring the dynamic
 * handle side on them showed almost nothing (52 -> 45) and nearly produced the
 * wrong conclusion, while the same change on this shape went 5 -> 1.
 *
 * So this one is deliberately out of flow order: the datastore sits to the left
 * of the services that read from it, and the audit sink is above its producers.
 * Positions are fixed, so the numbers it produces are comparable across runs.
 */

export interface HandPlacedDiagram {
  name: string;
  boxes: Map<string, ReadabilityBox>;
  edges: Array<{ id: string; sourceId: string; targetId: string; label?: string }>;
  /** Synthetic root, so the counter has a container to measure inside. */
  rootId: string;
  width: number;
  height: number;
}

const NODE_W = 180;
const NODE_H = 80;

const box = (x: number, y: number): ReadabilityBox => ({
  x,
  y,
  width: NODE_W,
  height: NODE_H,
});

export function handPlacedDiagram(): HandPlacedDiagram {
  const boxes = new Map<string, ReadabilityBox>([
    // Left column: the datastores, deliberately upstream of nothing.
    ["orders-db", box(60, 620)],
    ["audit-log", box(60, 60)],
    // Middle: the request path, left to right.
    ["client", box(60, 340)],
    ["gateway", box(420, 340)],
    ["orders", box(780, 260)],
    ["billing", box(780, 460)],
    // Right: a worker that writes back to the left-hand datastore.
    ["reporting", box(1140, 360)],
  ]);

  const edges = [
    { id: "e1", sourceId: "client", targetId: "gateway", label: "HTTPS" },
    { id: "e2", sourceId: "gateway", targetId: "orders", label: "routes" },
    { id: "e3", sourceId: "gateway", targetId: "billing", label: "routes" },
    // Against the flow: the datastore is to the left of everything using it.
    { id: "e4", sourceId: "orders", targetId: "orders-db", label: "reads/writes" },
    { id: "e5", sourceId: "billing", targetId: "orders-db", label: "reads" },
    { id: "e6", sourceId: "reporting", targetId: "orders-db", label: "scans" },
    // Against the flow vertically as well.
    { id: "e7", sourceId: "orders", targetId: "audit-log", label: "emits" },
    { id: "e8", sourceId: "billing", targetId: "audit-log", label: "emits" },
    { id: "e9", sourceId: "orders", targetId: "reporting", label: "feeds" },
  ];

  boxes.set("root", { x: 0, y: 0, width: 1500, height: 800 });

  return {
    name: "Hand-placed (out of flow order)",
    boxes,
    edges,
    rootId: "root",
    width: 1500,
    height: 800,
  };
}

/** Every node hangs off the synthetic root; there is no containment here. */
export function handPlacedParents(diagram: HandPlacedDiagram): Map<string, string | null> {
  const parentOf = new Map<string, string | null>();
  for (const id of diagram.boxes.keys()) {
    parentOf.set(id, id === diagram.rootId ? null : diagram.rootId);
  }
  return parentOf;
}

export function handPlacedLabels(diagram: HandPlacedDiagram): Map<string, string> {
  return new Map(
    diagram.edges
      .filter((edge) => edge.label !== undefined)
      .map((edge) => [edge.id, edge.label ?? ""]),
  );
}
