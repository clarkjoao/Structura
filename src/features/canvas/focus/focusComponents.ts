import type { ReactFlowInstance } from "@xyflow/react";
import { FIT_VIEW_DURATION_MS, FIT_VIEW_PADDING } from "../canvas.constants";
import type { CanvasVisualState } from "../hooks/useCanvasVisualState";

type FocusVisualState = Pick<
  CanvasVisualState,
  "setSelectedNodeId" | "setSelectedNodeIds" | "setSelectedEdgeId"
>;

const FOCUS_MAX_ZOOM = 1;

/** A rectangle in flow coordinates. */
export interface FlowRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Whether every rectangle is wholly on screen, for a viewport `[x, y, zoom]` over a canvas of
 * `width` × `height` pixels. Nothing to show counts as shown.
 */
export function allInView(
  rects: readonly FlowRect[],
  [x, y, zoom]: readonly [number, number, number],
  width: number,
  height: number,
): boolean {
  const left = -x / zoom;
  const top = -y / zoom;
  const right = left + width / zoom;
  const bottom = top + height / zoom;
  return rects.every(
    (r) => r.x >= left && r.y >= top && r.x + r.width <= right && r.y + r.height <= bottom,
  );
}

/**
 * Brings these components into view unless all of them already are, so the reader's pan and
 * zoom stay while what is pointed at is on screen. `size` is the canvas's, in pixels.
 */
export function frameUnlessInView(
  reactFlow: ReactFlowInstance,
  componentIds: readonly string[],
  size: { width: number; height: number },
): void {
  const ids = componentIds.filter((id) => reactFlow.getNode(id));
  const rects = ids.flatMap((id) => {
    const node = reactFlow.getInternalNode(id);
    const { width, height } = node?.measured ?? {};
    if (!node || width === undefined || height === undefined) return [];
    return [{ ...node.internals.positionAbsolute, width, height }];
  });
  const { x, y, zoom } = reactFlow.getViewport();
  if (!allInView(rects, [x, y, zoom], size.width, size.height)) frameComponents(reactFlow, ids);
}

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
