import type { Component } from "@/features/diagram";
import type { NodeTypeDescriptor } from "./node-types/types";
import type { CoverageInfo } from "../flow/flowState";
import { OPACITY_FLOW_PLAYBACK_NODE_DIM } from "../canvas.constants";
import { resolveNodeView } from "../core/resolveViewSnapshot";

export interface NodeVisibilityState {
  isChild: boolean;
  zIndex: number;
  isHidden: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  dimmed: boolean;
}

// Nesting, stacking and hiding are the view's rule, shared with the viewer;
// this module adds what only the editor has on top: the selection.
export { buildCollapsedPanelIds } from "../core/resolveViewSnapshot";

export function computeNodeVisibility(
  comp: Component,
  descriptor: NodeTypeDescriptor,
  layout: { zIndex?: number } | undefined,
  panelIds: Set<string>,
  selectedNodeIds: Set<string>,
  highlightedNodeIds: Set<string>,
  collapsedPanelIds: Set<string>,
  isViewingCoverage: boolean,
  coverage: CoverageInfo | null,
  components: Record<string, Component>,
): NodeVisibilityState {
  const { isChild, zIndex, isHidden } = resolveNodeView(
    comp,
    descriptor,
    layout,
    panelIds,
    collapsedPanelIds,
    components,
  );
  const focus = resolveSelectionFocus(comp, isChild, isHidden, selectedNodeIds, highlightedNodeIds);
  return {
    isChild,
    zIndex,
    isHidden,
    isSelected: focus.isSelected,
    isHighlighted: focus.isHighlighted,
    dimmed: focus.dimmedBySelection || isDimmedByCoverage(comp, isViewingCoverage, coverage),
  };
}

/**
 * What the selection makes of one node: selected, highlighted, or dimmed
 * because something else has the focus. A node under a selected panel, or one
 * already hidden, is never dimmed by it.
 *
 * Shared by `computeNodeVisibility` and the editor's focus overlay
 * (`nodeOverlays.ts`), so the two cannot drift.
 */
export function resolveSelectionFocus(
  comp: Component,
  isChild: boolean,
  isHidden: boolean,
  selectedNodeIds: Set<string>,
  highlightedNodeIds: Set<string>,
): { isSelected: boolean; isHighlighted: boolean; dimmedBySelection: boolean } {
  const isSelected = selectedNodeIds.has(comp.id);
  const isHighlighted = highlightedNodeIds.has(comp.id);
  const hasFocusedNodes = selectedNodeIds.size > 0 || highlightedNodeIds.size > 0;
  const isChildOfSelectedPanel =
    isChild && comp.parentId !== null && selectedNodeIds.has(comp.parentId);
  return {
    isSelected,
    isHighlighted,
    dimmedBySelection:
      hasFocusedNodes && !isSelected && !isHighlighted && !isHidden && !isChildOfSelectedPanel,
  };
}

/** Coverage view: a node no flow walks through is dimmed. */
export function isDimmedByCoverage(
  comp: Component,
  isViewingCoverage: boolean,
  coverage: CoverageInfo | null,
): boolean {
  return isViewingCoverage && !!coverage && !coverage.nodeFlows.get(comp.id)?.length;
}

/**
 * What the *selection* contributes to a node's opacity, or nothing.
 *
 * Two dimming systems share this one channel. The descriptor's style says what
 * the flow makes of the node — the step in hand, one already walked, one the
 * script never names. This says what the selection makes of it, and the two
 * used to collide: applied last, the selection won, so a node that was step 1
 * of the script was drawn exactly as dim as a node the script never mentions.
 *
 * While a flow is open the flow decides and the selection stands down. Outside
 * a flow nothing changes: focus dimming is the canvas-wide behaviour it always
 * was.
 */
export function selectionDimOpacity(
  vis: NodeVisibilityState,
  flowModeActive: boolean,
): number | undefined {
  if (!vis.dimmed) return undefined;
  if (flowModeActive) return undefined;
  return OPACITY_FLOW_PLAYBACK_NODE_DIM;
}
