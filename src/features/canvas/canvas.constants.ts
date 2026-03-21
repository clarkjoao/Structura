/** Injected alongside React Flow to match app theme and selection affordances */
export const CANVAS_STYLES = `
  .react-flow__pane { cursor: default; }
  .react-flow__pane:active { cursor: grabbing; }
  .react-flow__selection { background: rgba(59, 130, 246, 0.08); border: 1px solid #3b82f6; }
  .react-flow__background pattern circle { fill: hsl(var(--grid-line)); }
`;
