export const OPACITY_TAG_FILTER_DIM = 0.15;

export const OPACITY_TAG_FILTER_TRANSITION = "opacity 0.2s ease";

export const OPACITY_FLOW_PLAYBACK_EDGE_DIM = 0.2;

export const OPACITY_FLOW_PLAYBACK_PARTICIPANT = 0.5;

export const OPACITY_TAG_FILTER_EDGE_DIM = 0.1;

export const OPACITY_FLOW_PLAYBACK_NODE_DIM = 0.3;

export const FIT_VIEW_DURATION_MS = 400;
export const FIT_VIEW_PADDING = 0.35;
export const FIT_VIEW_MAX_ZOOM = 1.5;

export const VIEWPORT_MIN_ZOOM = 0.3;
export const FIT_VIEW_INITIAL_PADDING = 0.3;

/** Max zoom reachable via the custom wheel handler. Must match `<ReactFlow maxZoom>`. */
export const WHEEL_MAX_ZOOM = 1.5;
/** Per-step zoom factor for the custom wheel handler. */
export const WHEEL_ZOOM_FACTOR = 1.1;

/**
 * Pixels per line used to normalize `WheelEvent.deltaMode === DOM_DELTA_LINE`. Mice that report
 * line deltas would otherwise pan a few pixels per notch.
 */
export const WHEEL_LINE_HEIGHT_PX = 16;

// Re-exported for internal use in canvas features
export { VIEWPORT_DEBOUNCE_MS } from "@/features/diagram";

export const FIELD_DEBOUNCE_MS = 300;

export const FLOW_PARTICLE_DURATION_MS = 1200;

/** Canvas grid spacing (flow units) shared by node snapping and edge editing. */
export const GRID_SIZE = 15;

/**
 * E2E-only escape hatch for `snapToGrid`.
 *
 * Why it has to exist: `snapGrid=[15, 15]` quantises node positions, so a drag
 * shorter than half a grid step produces no movement AT ALL — with or without
 * the `DRAG_THRESHOLD_PX` gate. That made the two "3 px does not move" tests
 * unfalsifiable: mutating `DRAG_THRESHOLD_PX` to 0 left both of them green,
 * which is exactly the shape of the original defect this phase was fixing (a
 * threshold declared working on the strength of a test that never exercised
 * it). With snap off the drag distance reaches the rendered transform intact
 * and the gate becomes observable.
 *
 * The flag is set by Cypress in `cy.visit(..., { onBeforeLoad })`, before the
 * app boots, and is never set in production — `undefined` keeps `snapToGrid`
 * on, so shipped behaviour is untouched. It deliberately does NOT go through
 * `canvas-preferences.store`: snapping is not a user-facing setting and making
 * it one would be a product decision, not a test fixture.
 */
export function isSnapToGridDisabledForE2E(): boolean {
  if (typeof window === "undefined") return false;
  return (window as { __structuraE2eDisableSnap?: boolean }).__structuraE2eDisableSnap === true;
}

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
  /*
   * Phase 4 — decision #9: the bounding-box rect that React Flow draws around a
   * multi-selection (Cmd+A) used to intercept pane clicks. With pointer-events
   * disabled, keyboard focus is unaffected (arrow keys still nudge, Ctrl+A
   * still re-selects), but mouse clicks inside the bbox fall through to the
   * pane and clear the selection as a regular pane click would.
   *
   * The rect's own context-menu handler is also gated by this, which is the
   * desired behaviour: a right-click inside the bbox opens the menu against
   * whatever element is actually under the cursor (the pane or a node behind),
   * not against the invisible selection box.
   */
  .react-flow__nodesselection-rect { pointer-events: none; }
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
