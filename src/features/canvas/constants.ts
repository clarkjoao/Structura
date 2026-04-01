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

/** Injected alongside React Flow to match app theme and selection affordances */
export const CANVAS_STYLES = `
  .react-flow__pane { cursor: default; }
  .react-flow__pane:active { cursor: grabbing; }
  .react-flow__selection { background: rgba(59, 130, 246, 0.08); border: 1px solid #3b82f6; }
  .react-flow__background pattern circle { fill: hsl(var(--grid-line)); }
`;
