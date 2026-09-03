import type { Component } from "@/features/diagram";
import { isPanelComponent } from "@/features/diagram";
import type { NodeTypeDescriptor } from "./node-types/types";
import type { CoverageInfo } from "../flow/flowState";
import { OPACITY_FLOW_PLAYBACK_NODE_DIM } from "../canvas.constants";

export interface NodeVisibilityState {
  isChild: boolean;
  zIndex: number;
  isHidden: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  dimmed: boolean;
}

export function buildCollapsedPanelIds(components: Record<string, Component>): Set<string> {
  return new Set(
    Object.values(components)
      .filter((c) => isPanelComponent(c) && c.collapsed)
      .map((c) => c.id),
  );
}

function hasCollapsedOrHiddenAncestor(
  comp: Component,
  components: Record<string, Component>,
  collapsedPanelIds: Set<string>,
): boolean {
  let currentParentId = comp.parentId;
  while (currentParentId !== null && currentParentId !== undefined) {
    const parent = components[currentParentId];
    if (!parent) break;
    if (collapsedPanelIds.has(currentParentId)) return true;
    if (parent.hidden === true) return true;
    currentParentId = parent.parentId;
  }
  return false;
}

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
  const isChild = descriptor.canHaveParent && comp.parentId !== null && panelIds.has(comp.parentId);
  const zIndex =
    layout?.zIndex ??
    (typeof descriptor.zIndex === "function" ? descriptor.zIndex(comp) : descriptor.zIndex);
  const isHidden =
    comp.hidden === true || hasCollapsedOrHiddenAncestor(comp, components, collapsedPanelIds);
  const isSelected = selectedNodeIds.has(comp.id);
  const isHighlighted = highlightedNodeIds.has(comp.id);
  const hasFocusedNodes = selectedNodeIds.size > 0 || highlightedNodeIds.size > 0;
  const isChildOfSelectedPanel =
    isChild && comp.parentId !== null && selectedNodeIds.has(comp.parentId);

  const dimWhenSelectionActive =
    hasFocusedNodes && !isSelected && !isHighlighted && !isHidden && !isChildOfSelectedPanel;
  const dimWhenCoverage =
    isViewingCoverage && !!coverage && !coverage.nodeFlows.get(comp.id)?.length;

  return {
    isChild,
    zIndex,
    isHidden,
    isSelected,
    isHighlighted,
    dimmed: dimWhenSelectionActive || dimWhenCoverage,
  };
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
