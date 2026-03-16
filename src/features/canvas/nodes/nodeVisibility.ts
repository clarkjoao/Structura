import type { Component } from "@/features/diagram";
import { isPanelComponent } from "@/features/diagram";
import type { NodeTypeDescriptor } from "../node-types/types";
import type { CoverageInfo } from "./flowState";

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
): NodeVisibilityState {
  const isChild = descriptor.canHaveParent && comp.parentId !== null && panelIds.has(comp.parentId);
  const zIndex = layout?.zIndex ?? (typeof descriptor.zIndex === "function" ? descriptor.zIndex(comp) : descriptor.zIndex);
  const isHidden = comp.hidden === true || (isChild && comp.parentId !== null && collapsedPanelIds.has(comp.parentId));
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
