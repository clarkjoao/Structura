import type { Edge } from "@xyflow/react";
import { OPACITY_TAG_FILTER_EDGE_DIM, OPACITY_TAG_FILTER_TRANSITION } from "../constants/opacity";

/*
 * The editor's overlays on a projected edge (`projectEdges` in
 * `core/projectDiagram.ts`), the edge counterpart of `nodes/nodeOverlays.ts`.
 * Each is a no-op when it does not apply and may only add to style, add a
 * class or mark the edge selected — the route, handles and markers are the
 * projection's.
 *
 * Order matters for style only: compare mode sets the opacity, then the tag
 * filter replaces the style whole (as it always has — it drops the stroke
 * colour and the flow opacity along with it). `applyEditorEdgeOverlays`
 * fixes that order.
 */

/** The edge the author clicked. */
export function selectedEdgeOverlay(edge: Edge, selectedEdgeId: string | null): Edge {
  return selectedEdgeId !== null && edge.id === selectedEdgeId ? { ...edge, selected: true } : edge;
}

/** Comparing two scenes: the edge takes the opacity the comparison gives it. */
export function compareEdgeOverlay(
  edge: Edge,
  isCompareMode: boolean,
  compareConnectionOpacity: Record<string, number> | undefined,
): Edge {
  if (!isCompareMode || !compareConnectionOpacity) return edge;
  const opacity = compareConnectionOpacity[edge.id];
  if (opacity === undefined) return edge;
  return { ...edge, style: { ...edge.style, opacity } };
}

/** An edge touching a node the tag filter hides: faded and click-through. */
export function tagFilterEdgeOverlay(edge: Edge, dimmedByTag: boolean): Edge {
  if (!dimmedByTag) return edge;
  return {
    ...edge,
    style: {
      opacity: OPACITY_TAG_FILTER_EDGE_DIM,
      pointerEvents: "none",
      transition: OPACITY_TAG_FILTER_TRANSITION,
    },
  };
}

/** An edge an LLM suggestion would add, waiting to be kept or discarded. */
export function pendingEdgeOverlay(edge: Edge, pending: boolean): Edge {
  return pending ? { ...edge, className: `${edge.className ?? ""} edge-pending`.trim() } : edge;
}

export interface EditorEdgeOverlayInput {
  selectedEdgeId: string | null;
  isCompareMode: boolean;
  compareConnectionOpacity: Record<string, number> | undefined;
  dimmedByTag: boolean;
  pending: boolean;
}

/** Every editor edge overlay, compare before the tag filter (see the module note). */
export function applyEditorEdgeOverlays(edge: Edge, input: EditorEdgeOverlayInput): Edge {
  let next = selectedEdgeOverlay(edge, input.selectedEdgeId);
  next = compareEdgeOverlay(next, input.isCompareMode, input.compareConnectionOpacity);
  next = tagFilterEdgeOverlay(next, input.dimmedByTag);
  return pendingEdgeOverlay(next, input.pending);
}
