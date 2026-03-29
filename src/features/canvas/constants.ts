/** Default width for panel nodes (px). */
export const PANEL_DEFAULT_W = 600;
/** Default height for panel nodes (px). */
export const PANEL_DEFAULT_H = 400;
/** Default width for swimlane panel kind (px). */
export const SWIMLANE_DEFAULT_W = 800;
/** Default height for swimlane panel kind (px). */
export const SWIMLANE_DEFAULT_H = 200;
/** Collapsed panel width (px). */
export const PANEL_COLLAPSED_W = 200;
/** Collapsed panel height (px). */
export const PANEL_COLLAPSED_H = 60;
/** Minimum number of handles per node side. */
export const MIN_HANDLES = 1;
/** Maximum number of handles per node side. */
export const MAX_HANDLES = 4;
/** Padding added around grouped nodes when creating a panel (px). */
export const NODE_DRAG_PADDING = 40;
/** Default width for non-panel nodes (px). */
export const DEFAULT_NODE_W = 180;
/** Default height for non-panel nodes (px). */
export const DEFAULT_NODE_H = 80;
/** A3 paper dimensions for notes (297×420mm ratio). */
export const NOTE_DEFAULT_W = 336;
export const NOTE_DEFAULT_H = 475;

export const NOTE_COLLAPSED_W = 200;
export const NOTE_COLLAPSED_H = 60;

/** Collapsed database table node (px) — alinhado ao note colapsado. */
export const DB_TABLE_COLLAPSED_W = 200;
export const DB_TABLE_COLLAPSED_H = 60;

/** Injected alongside React Flow to match app theme and selection affordances */
export const CANVAS_STYLES = `
  .react-flow__pane { cursor: default; }
  .react-flow__pane:active { cursor: grabbing; }
  .react-flow__selection { background: rgba(59, 130, 246, 0.08); border: 1px solid #3b82f6; }
  .react-flow__background pattern circle { fill: hsl(var(--grid-line)); }
`;
