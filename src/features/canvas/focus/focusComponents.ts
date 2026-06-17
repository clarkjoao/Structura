import type { ReactFlowInstance } from "@xyflow/react";
import { FIT_VIEW_DURATION_MS, FIT_VIEW_PADDING } from "../canvas.constants";
import type { CanvasVisualState } from "../hooks/useCanvasVisualState";

type FocusVisualState = Pick<
  CanvasVisualState,
  "setSelectedNodeId" | "setSelectedNodeIds" | "setSelectedEdgeId"
>;

const FOCUS_MAX_ZOOM = 1;

export function focusComponentsOnCanvas(
  reactFlow: ReactFlowInstance,
  visualState: FocusVisualState,
  componentIds: string[],
): void {
  if (componentIds.length === 0) return;

  visualState.setSelectedNodeIds(new Set(componentIds));
  visualState.setSelectedNodeId(componentIds[0] ?? null);
  visualState.setSelectedEdgeId(null);

  void reactFlow.fitView({
    nodes: componentIds.map((id) => ({ id })),
    duration: FIT_VIEW_DURATION_MS,
    padding: FIT_VIEW_PADDING,
    maxZoom: FOCUS_MAX_ZOOM,
  });
}
