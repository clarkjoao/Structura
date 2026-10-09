import type { ReactFlowInstance } from "@xyflow/react";
import { FIT_VIEW_DURATION_MS, FIT_VIEW_PADDING } from "../canvas.constants";
import type { CanvasVisualState } from "../hooks/useCanvasVisualState";

type FocusVisualState = Pick<
  CanvasVisualState,
  "setSelectedNodeId" | "setSelectedNodeIds" | "setSelectedEdgeId"
>;

const FOCUS_MAX_ZOOM = 1;

/** Moves the viewport onto these components, never zooming past 1:1. Selection is untouched. */
export function frameComponents(
  reactFlow: ReactFlowInstance,
  componentIds: readonly string[],
): void {
  if (componentIds.length === 0) return;
  void reactFlow.fitView({
    nodes: componentIds.map((id) => ({ id })),
    duration: FIT_VIEW_DURATION_MS,
    padding: FIT_VIEW_PADDING,
    maxZoom: FOCUS_MAX_ZOOM,
  });
}

export function focusComponentsOnCanvas(
  reactFlow: ReactFlowInstance,
  visualState: FocusVisualState,
  componentIds: string[],
): void {
  if (componentIds.length === 0) return;

  visualState.setSelectedNodeIds(new Set(componentIds));
  visualState.setSelectedNodeId(componentIds[0] ?? null);
  visualState.setSelectedEdgeId(null);

  frameComponents(reactFlow, componentIds);
}
