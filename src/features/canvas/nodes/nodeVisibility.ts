import type { Component } from "@/features/diagram";
import { isPanelComponent } from "@/features/diagram";
import type { NodeTypeDescriptor } from "./node-types/types";
import type { CoverageInfo } from "@/features/flows";

export interface NodeVisibilityState {
  isChild: boolean;
  zIndex: number;
  isHidden: boolean;
  isSelected: boolean;
  isHighlighted: boolean;
  dimmed: boolean;
}

export function buildCollapsedPanelIds(
  components: Record<string, Component>,
): Set<string> {
  return new Set(
    Object.values(components)
      .filter((c) => isPanelComponent(c) && c.collapsed)
      .map((c) => c.id),
  );
}

/**
 * Returns true when any ancestor in the parent chain is collapsed or hidden.
 */
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
  const zIndex = layout?.zIndex ?? (typeof descriptor.zIndex === "function" ? descriptor.zIndex(comp) : descriptor.zIndex);
  const isHidden =
    comp.hidden === true ||
    hasCollapsedOrHiddenAncestor(comp, components, collapsedPanelIds);
  const isSelected = selectedNodeIds.has(comp.id);
  const isHighlighted = highlightedNodeIds.has(comp.id);
  const hasFocusedNodes = selectedNodeIds.size > 0 || highlightedNodeIds.size > 0;
  const isChildOfSelectedPanel = isChild && comp.parentId !== null && selectedNodeIds.has(comp.parentId);

  const dimWhenSelectionActive =
    hasFocusedNodes && !isSelected && !isHighlighted && !isHidden && !isChildOfSelectedPanel;
  const dimWhenCoverage =
    isViewingCoverage && !!coverage && !(coverage.nodeFlows.get(comp.id)?.length);

  return {
    isChild,
    zIndex,
    isHidden,
    isSelected,
    isHighlighted,
    dimmed: dimWhenSelectionActive || dimWhenCoverage,
  };
}
