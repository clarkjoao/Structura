import type { LayoutGraph, LayoutResult } from "./contract";
import { generateId, useDiagramStore } from "@/features/diagram";

/**
 * Parameters for the unified layout applicator.
 *
 * `diagramId` is null when there is no active diagram — the function still
 * applies positions via `applyAutoLayout`, but skips edge effects.
 */
export interface ApplyLayoutResultOptions {
  /** Which edges get waypoints written. Defaults to all edges from the graph. */
  edgeIds?: ReadonlySet<string> | null;
  /**
   * Override a node's x/y with where it currently sits.
   * Used by `usePanelChildLayout` to preserve a panel's dragged position while
   * adopting its computed size.
   */
  positionOverrides?: Map<string, { x: number; y: number }>;
  /**
   * Offset added to every waypoint's coordinates.
   * Only needed when the layout result was anchored somewhere other than (0,0) —
   * e.g., `FlowPanel` centers the layout on the insertion point before writing.
   */
  waypointOffset?: { x: number; y: number };
}

/**
 * The three post-layout steps, in one place, so they cannot drift apart.
 *
 * Every consumer of `layout()` repeats this sequence after getting the result:
 *
 *   1. write positions via `applyAutoLayout`  ← the caller owns the `toAppliedLayouts` call
 *   2. write ELK's handle ordering into every node's `handleOrder`
 *   3. write ELK's bend points as edge control points
 *
 * Separating positions from (2) and (3) allows the caller to pass their own
 * offset (`toAppliedLayouts(graph, result, resizable, offset)`) without
 * duplicating the edge-writing logic.
 *
 * This function does NOT call `applyAutoLayout` — the caller already does that.
 * It only handles the edge effects.
 *
 * @param graph       The layout graph that produced `result`.
 * @param result      The layout result from `layout()`.
 * @param diagramId   The active diagram ID, or null to skip edge effects.
 * @param options     Optional edge-id filter, position overrides, waypoint offset.
 */
export function applyLayoutResultEdges(
  graph: LayoutGraph,
  result: LayoutResult,
  diagramId: string | null,
  options: ApplyLayoutResultOptions = {},
): void {
  const { edgeIds = null, waypointOffset = { x: 0, y: 0 } } = options;

  if (diagramId === null) return;

  const store = useDiagramStore.getState();

  // Determine which edge ids actually get waypoints.
  // By default, every edge from the graph participates.
  const edgesToStyle = edgeIds === null
    ? graph.edges
    : graph.edges.filter((e) => edgeIds.has(e.id));

  // Handle order — written unconditionally for all nodes in the graph.
  for (const node of graph.nodes) {
    const outgoing = result.handleOrder.outgoing.get(node.id);
    if (outgoing?.length) store.updateHandleOrder(node.id, "outgoing", outgoing);
    const incoming = result.handleOrder.incoming.get(node.id);
    if (incoming?.length) store.updateHandleOrder(node.id, "incoming", incoming);
  }

  // Clear existing waypoints for every edge that participated in this layout, then
  // write the new ones.  Edges that were previously routed but are no longer in the
  // graph are left untouched — this function only owns the edges it knows about.
  for (const edge of edgesToStyle) {
    store.resetEdgeControlPoints(diagramId, edge.id);
  }

  // Write waypoints for all (or filtered) edges from the graph.
  for (const edge of edgesToStyle) {
    const route = result.edgeRoutes.get(edge.id);
    if (route === undefined || route.length <= 2) continue;

    // Convert ELK's canvas-absolute route into control points.
    // The first and last route entries sit on the node borders; the canvas draws
    // those legs from the handles, so only the slice between them becomes CPs.
    const waypoints = route
      .slice(1, -1)
      .map((pt) => ({ id: generateId("cp"), x: pt.x + waypointOffset.x, y: pt.y + waypointOffset.y }));

    if (waypoints.length > 0) {
      store.setEdgeControlPoints(diagramId, edge.id, waypoints, { history: false });
    }
  }
}
