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

/*
 * Handed to <ReactFlow fitViewOptions> as these very objects, never a copy. React Flow's
 * StoreUpdater writes the prop into its store whenever its identity changes, and that store
 * field is also where `reactFlowInstance.fitView(options)` parks its options until the nodes
 * are measured. A fresh copy per render overwrote a pending fit's options (the opening fit's
 * min/max zoom among them) with these, so the opening zoom depended on whether the canvas
 * re-rendered before React Flow measured the nodes (audit R8).
 */
export const FIT_VIEW_OPTIONS_WRITE: { readonly padding: number } = Object.freeze({
  padding: FIT_VIEW_INITIAL_PADDING,
});

export const FIT_VIEW_OPTIONS_READ: { readonly padding: number } = Object.freeze({
  padding: FIT_VIEW_READING_PADDING,
});

/**
 * Middle + right button pan (draw.io-style). Left button selects / marquees: a
 * left-drag on the empty canvas draws a selection box (`selectionOnDrag`), as in
 * draw.io, Figma and Excalidraw. Product decision C4 (2026-11-13) keeps it that way;
 * the audit's "drag on empty canvas does nothing" was a box that covered no element.
 */
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
  fitViewOptions: { readonly padding: number };
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
      fitViewOptions: FIT_VIEW_OPTIONS_READ,
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
    fitViewOptions: FIT_VIEW_OPTIONS_WRITE,
    proOptions: PRO_OPTIONS,
    className: "bg-background",
  };
}
