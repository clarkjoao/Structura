import type { LayoutGraph, LayoutResult } from "./contract";
import { generateId, useDiagramStore } from "@/features/diagram";
import { MAX_HANDLES, MIN_HANDLES } from "../canvas.constants";
import { absoluteBoxesFromLayout } from "./absoluteBoxesFromLayout";
import { alignElkRouteToHandles } from "./alignElkRouteToHandles";
import { handleAnchor } from "./renderedEdgePath";

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
   * adopting its computed size — absolute handle anchors must use the same
   * origin as the stored layout or ELK corridors land offset from the panel.
   */
  positionOverrides?: Map<string, { x: number; y: number }>;
  /**
   * Offset added to every waypoint's coordinates.
   * Only needed when the layout result was anchored somewhere other than (0,0) —
   * e.g., `FlowPanel` centers the layout on the insertion point before writing.
   */
  waypointOffset?: { x: number; y: number };
  /**
   * Leave the participating edges with no stored path at all.
   *
   * The default writes handle-aligned ELK corridors as control points — what
   * Cmd/Ctrl+Shift+L and the LLM apply path use. Raw ELK bends attach to node
   * borders; Structura draws from discrete L/R handles, so bends are adapted
   * with `alignElkRouteToHandles` before writing.
   *
   * Opt in with `resetPaths: true` only when a caller wants an untouched
   * mid-X Z. Handle order is unaffected either way. See
   * `applyLayoutResult.resetPaths.test.ts`.
   */
  resetPaths?: boolean;
  /**
   * Translates layout-graph ids into store ids.
   *
   * Four of the five consumers lay out a graph they built from the store, so
   * graph id and store id are the same string and the identity mapping is
   * right. The generation path is the exception: its graph is keyed by IR ids
   * (`node.id`, `edge.id` as the model wrote them) and the components and
   * connections it just inserted carry ids the store minted. That mismatch is
   * the whole reason `apply-ir` kept a waypoint loop of its own; expressing it
   * as a translation is what lets the loop go away.
   *
   * Returning `undefined` means "this graph element has no store counterpart" —
   * the element is skipped, not defaulted to its graph id.
   */
  idMap?: {
    node?: (graphNodeId: string) => string | undefined;
    edge?: (graphEdgeId: string) => string | undefined;
  };
}

/** Identity, so the common case pays nothing for the generation path's mapping. */
const identity = (id: string): string | undefined => id;

/**
 * The three post-layout steps, in one place, so they cannot drift apart.
 *
 * Every consumer of `layout()` repeats this sequence after getting the result:
 *
 *   1. write positions via `applyAutoLayout`  ← the caller owns the `toAppliedLayouts` call
 *   2. write ELK's handle ordering into every node's `handleOrder`
 *   3. write handle-aligned ELK corridors as edge control points
 *
 * Separating positions from (2) and (3) allows the caller to pass their own
 * offset (`toAppliedLayouts(graph, result, resizable, offset)`) without
 * duplicating the edge-writing logic.
 *
 * This function does NOT call `applyAutoLayout` — the caller already does that.
 * It only handles the edge effects.
 */
export function applyLayoutResultEdges(
  graph: LayoutGraph,
  result: LayoutResult,
  diagramId: string | null,
  options: ApplyLayoutResultOptions = {},
): void {
  const {
    edgeIds = null,
    waypointOffset = { x: 0, y: 0 },
    resetPaths = false,
    positionOverrides,
  } = options;
  const nodeIdOf = options.idMap?.node ?? identity;
  const edgeIdOf = options.idMap?.edge ?? identity;

  if (diagramId === null) return;

  const store = useDiagramStore.getState();

  const edgesToStyle =
    edgeIds === null ? graph.edges : graph.edges.filter((e) => edgeIds.has(e.id));

  for (const node of graph.nodes) {
    const storeNodeId = nodeIdOf(node.id);
    if (storeNodeId === undefined) continue;
    for (const side of ["outgoing", "incoming"] as const) {
      const ordering = result.handleOrder[side].get(node.id);
      if (!ordering?.length) continue;
      const storeOrdering = ordering.map(edgeIdOf).filter((id): id is string => id !== undefined);
      if (storeOrdering.length === 0) continue;
      store.updateHandleOrder(storeNodeId, side, storeOrdering);
    }
  }

  for (const edge of edgesToStyle) {
    const storeEdgeId = edgeIdOf(edge.id);
    if (storeEdgeId !== undefined) store.resetEdgeControlPoints(diagramId, storeEdgeId);
  }

  if (resetPaths) return;

  const absBoxes = absoluteBoxesFromLayout(graph, result, positionOverrides);
  const outgoingCount = new Map<string, number>();
  const incomingCount = new Map<string, number>();
  for (const edge of graph.edges) {
    outgoingCount.set(edge.sourceId, (outgoingCount.get(edge.sourceId) ?? 0) + 1);
    incomingCount.set(edge.targetId, (incomingCount.get(edge.targetId) ?? 0) + 1);
  }

  for (const edge of edgesToStyle) {
    const storeEdgeId = edgeIdOf(edge.id);
    if (storeEdgeId === undefined) continue;

    const sourceBox = absBoxes.get(edge.sourceId);
    const targetBox = absBoxes.get(edge.targetId);
    if (!sourceBox || !targetBox) continue;

    const sourceCount = clampHandleCount(outgoingCount.get(edge.sourceId) ?? 1);
    const targetCount = clampHandleCount(incomingCount.get(edge.targetId) ?? 1);
    const sourceSlot = resolveSlot(
      edge.id,
      result.handleOrder.outgoing.get(edge.sourceId),
      sourceCount,
    );
    const targetSlot = resolveSlot(
      edge.id,
      result.handleOrder.incoming.get(edge.targetId),
      targetCount,
    );

    const source = handleAnchor(sourceBox, "source", sourceSlot, sourceCount);
    const target = handleAnchor(targetBox, "target", targetSlot, targetCount);
    const route = result.edgeRoutes.get(edge.id);
    const corners = alignElkRouteToHandles(route, source, target);

    if (corners.length === 0) continue;

    store.setEdgeControlPoints(
      diagramId,
      storeEdgeId,
      corners.map((point) => ({
        id: generateId("cp"),
        x: point.x + waypointOffset.x,
        y: point.y + waypointOffset.y,
      })),
      { history: false },
    );
  }
}

function clampHandleCount(count: number): number {
  return Math.min(MAX_HANDLES, Math.max(MIN_HANDLES, count));
}

function resolveSlot(edgeId: string, order: string[] | undefined, slotCount: number): number {
  if (order?.length) {
    const index = order.indexOf(edgeId);
    if (index !== -1) return Math.min(index, slotCount - 1);
  }
  return 0;
}
