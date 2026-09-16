export const PANEL_DEFAULT_W = 600;
export const PANEL_DEFAULT_H = 400;
export const SWIMLANE_DEFAULT_W = 800;
export const SWIMLANE_DEFAULT_H = 200;

export const PANEL_COLLAPSED_W = 200;
export const PANEL_COLLAPSED_H = 60;

export const NOTE_DEFAULT_W = 336;
export const NOTE_DEFAULT_H = 475;
export const NOTE_COLLAPSED_W = 200;
export const NOTE_COLLAPSED_H = 60;

export const DB_TABLE_COLLAPSED_W = 200;
export const DB_TABLE_COLLAPSED_H = 60;

export const MIN_HANDLES = 1;
/**
 * Visual handle slots per node side (source-N / target-N dots on the card).
 *
 * This is **not** a cap on how many edges a node may have. Connections beyond
 * this count still exist; they share/clamp onto the available slots via
 * `buildEdgeHandleAssignments` / `handleOrder`. Raising the number only spreads
 * more distinct ports along the side for denser fans.
 */
export const MAX_HANDLES = 8;
export const NODE_DRAG_PADDING = 40;
export const DEFAULT_NODE_W = 180;
export const DEFAULT_NODE_H = 80;

export const API_GROUP_HEADER_H = 68;
export const API_GROUP_ENDPOINT_H = 40;
export const API_GROUP_FOOTER_H = 40;
export const API_GROUP_FRAME_W = 300;
