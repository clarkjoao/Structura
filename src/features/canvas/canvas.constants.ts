export const OPACITY_TAG_FILTER_DIM = 0.15;

export const OPACITY_FLOW_PLAYBACK_EDGE_DIM = 0.2;

export const OPACITY_FLOW_PLAYBACK_PARTICIPANT = 0.5;

export const OPACITY_TAG_FILTER_EDGE_DIM = 0.1;

export const OPACITY_FLOW_PLAYBACK_NODE_DIM = 0.3;

export const EDGE_SEGMENT_HIGHLIGHT_STROKE_OPACITY = 0.35;

export const FIT_VIEW_DURATION_MS = 400;
export const FIT_VIEW_PADDING = 0.35;
export const FIT_VIEW_MAX_ZOOM = 1.5;

export const VIEWPORT_MIN_ZOOM = 0.3;
export const FIT_VIEW_INITIAL_PADDING = 0.3;

/** Max zoom reachable via the custom wheel handler. Must match `<ReactFlow maxZoom>`. */
export const WHEEL_MAX_ZOOM = 1.5;
/** Per-step zoom factor for the custom wheel handler. */
export const WHEEL_ZOOM_FACTOR = 1.1;

export { VIEWPORT_DEBOUNCE_MS } from "@/features/diagram";

export const FIELD_DEBOUNCE_MS = 300;

export { MAX_HISTORY_STEPS } from "@/features/diagram";

export { HISTORY_COALESCE_MS } from "@/features/diagram";

export { UNDO_REDO_COOLDOWN_MS } from "@/features/diagram";

export const FLOW_PARTICLE_DURATION_MS = 1200;

/** Canvas grid spacing (flow units) shared by node snapping and edge editing. */
export const GRID_SIZE = 15;

export {
  PANEL_DEFAULT_W,
  PANEL_DEFAULT_H,
  SWIMLANE_DEFAULT_W,
  SWIMLANE_DEFAULT_H,
  PANEL_COLLAPSED_W,
  PANEL_COLLAPSED_H,
  MIN_HANDLES,
  MAX_HANDLES,
  NODE_DRAG_PADDING,
  DEFAULT_NODE_W,
  DEFAULT_NODE_H,
  NOTE_DEFAULT_W,
  NOTE_DEFAULT_H,
  NOTE_COLLAPSED_W,
  NOTE_COLLAPSED_H,
  DB_TABLE_COLLAPSED_W,
  DB_TABLE_COLLAPSED_H,
} from "@/features/diagram";

export const CANVAS_STYLES = `
  .react-flow__pane { cursor: default; }
  .react-flow__pane:active { cursor: grabbing; }
  .react-flow__selection { background: rgba(59, 130, 246, 0.08); border: 1px solid #3b82f6; }
  .react-flow__background pattern circle { fill: hsl(var(--grid-line)); }
  .node-diff-added {
    outline: 2px solid #22c55e;
    outline-offset: 3px;
  }
  .node-diff-removed {
    outline: 2px solid #ef4444;
    outline-offset: 3px;
    opacity: 0.5;
  }
  .node-diff-modified {
    outline: 2px solid #f59e0b;
    outline-offset: 3px;
  }
`;
