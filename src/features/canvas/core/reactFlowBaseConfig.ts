import { PanOnScrollMode, SelectionMode } from "@xyflow/react";
import {
  CANVAS_MAX_ZOOM,
  CANVAS_MIN_ZOOM,
  FIT_VIEW_INITIAL_PADDING,
  FIT_VIEW_MAX_ZOOM,
  FIT_VIEW_READING_PADDING,
  GRID_SIZE,
  VIEWPORT_MIN_ZOOM,
} from "../canvas.constants";
import type { CanvasInputProfile } from "../hooks/useCanvasInputProfile";
import type { DiagramSurfacePolicy } from "./canvasInteractionPolicy";

export { DIAGRAM_EDGE_RF_TYPE } from "./edgeTypeKey";

export const PRO_OPTIONS = { hideAttribution: true } as const;

export const SNAP_GRID: [number, number] = [GRID_SIZE, GRID_SIZE];

export const FIT_VIEW_OPTIONS_WRITE = { padding: FIT_VIEW_INITIAL_PADDING } as const;

export const FIT_VIEW_OPTIONS_READ = { padding: FIT_VIEW_READING_PADDING } as const;

/** Middle + right button pan (draw.io-style). Left button selects / marquees. */
export const PAN_ON_DRAG_MOUSE: [number, number] = [1, 2];

export const MULTI_SELECTION_KEY_CODES = ["Meta", "Control", "Shift"] as const;

export const PAN_ACTIVATION_KEY = "Space";

/** Neutralise RF's Shift=selection-mode so Shift stays a multi-select modifier. */
export const SELECTION_KEY_CODE: string | null = null;

/**
 * Stable React Flow props derived from a surface policy.
 *
 * Write and read keep different *input* profiles on purpose (Phase 5 may
 * converge them). Graph interactivity always follows `policy.graphInteractive`.
 */
export interface ReactFlowShellProps {
  nodesDraggable: boolean;
  nodesConnectable: boolean;
  elementsSelectable: boolean;
  panOnDrag: boolean | [number, number];
  panOnScroll: boolean;
  panOnScrollMode?: PanOnScrollMode;
  selectionOnDrag?: boolean;
  panActivationKeyCode?: string | null;
  selectionMode?: SelectionMode;
  zoomOnScroll: boolean;
  zoomOnPinch: boolean;
  zoomOnDoubleClick: boolean;
  deleteKeyCode?: string | null;
  minZoom: number;
  maxZoom: number;
  multiSelectionKeyCode?: readonly string[];
  selectionKeyCode?: string | null;
  snapToGrid?: boolean;
  snapGrid?: [number, number];
  fitViewOptions: { padding: number };
  proOptions: typeof PRO_OPTIONS;
  className: string;
}

export interface BuildReactFlowShellOptions {
  inputProfile?: CanvasInputProfile;
  snapToGrid?: boolean;
}

export function buildReactFlowShellProps(
  policy: DiagramSurfacePolicy,
  options: BuildReactFlowShellOptions = {},
): ReactFlowShellProps {
  if (policy.kind === "read") {
    return {
      nodesDraggable: false,
      nodesConnectable: false,
      elementsSelectable: false,
      panOnDrag: true,
      panOnScroll: true,
      panOnScrollMode: PanOnScrollMode.Free,
      zoomOnScroll: true,
      zoomOnPinch: true,
      zoomOnDoubleClick: false,
      minZoom: VIEWPORT_MIN_ZOOM,
      maxZoom: FIT_VIEW_MAX_ZOOM,
      fitViewOptions: { ...FIT_VIEW_OPTIONS_READ },
      proOptions: PRO_OPTIONS,
      className: "bg-background",
    };
  }

  const prefersTouch = options.inputProfile?.prefersTouchCanvasUi ?? false;
  const interactive = policy.graphInteractive;

  return {
    nodesDraggable: interactive,
    nodesConnectable: interactive,
    elementsSelectable: interactive,
    panOnDrag: prefersTouch ? true : PAN_ON_DRAG_MOUSE,
    panOnScroll: false,
    selectionOnDrag: !prefersTouch,
    panActivationKeyCode: prefersTouch ? null : PAN_ACTIVATION_KEY,
    selectionMode: SelectionMode.Partial,
    zoomOnScroll: false,
    zoomOnPinch: false,
    zoomOnDoubleClick: false,
    deleteKeyCode: null,
    minZoom: CANVAS_MIN_ZOOM,
    maxZoom: CANVAS_MAX_ZOOM,
    multiSelectionKeyCode: MULTI_SELECTION_KEY_CODES,
    selectionKeyCode: SELECTION_KEY_CODE,
    snapToGrid: options.snapToGrid ?? true,
    snapGrid: SNAP_GRID,
    fitViewOptions: { ...FIT_VIEW_OPTIONS_WRITE },
    proOptions: PRO_OPTIONS,
    className: "bg-background",
  };
}
