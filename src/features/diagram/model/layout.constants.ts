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
 *
 * 32, not 8: a side only renders as many slots as it has edges, so the cap is
 * only ever reached by a hub, and at 8 a hub's ninth edge onwards all shared the
 * last slot — drawn on top of each other into the node. ELK gives every edge
 * its own attachment point; this lets the canvas keep them.
 */
export const MAX_HANDLES = 32;
export const NODE_DRAG_PADDING = 40;

/** A panel's header with only a title: `py-2.5` twice around one `text-sm` line. */
export const PANEL_HEADER_H = 40;
/** One more `text-xs` line, the unselected (`line-clamp-1`) description. */
export const PANEL_HEADER_DESCRIPTION_H = 16;
/** Air between the header and the children inside the panel. */
export const PANEL_HEADER_GAP = 16;

/**
 * Space a panel reserves above its children: the header it draws, plus a gap.
 * The description counts as one line because that is how an unselected panel
 * renders it; the full text shows as an overlay while the panel is selected.
 */
export function panelTopInset(description?: string): number {
  const descriptionH = description?.trim() ? PANEL_HEADER_DESCRIPTION_H : 0;
  return PANEL_HEADER_H + descriptionH + PANEL_HEADER_GAP;
}
export const DEFAULT_NODE_W = 180;
export const DEFAULT_NODE_H = 80;

export const API_GROUP_HEADER_H = 68;
export const API_GROUP_ENDPOINT_H = 40;
export const API_GROUP_FOOTER_H = 40;
export const API_GROUP_FRAME_W = 300;

/**
 * The grid a catalog pattern is authored on: one cell per node. Wider than the
 * widest card (260) and taller than a card with its title, so two cells never
 * hold overlapping nodes.
 */
export const PATTERN_CELL_W = 300;
export const PATTERN_CELL_H = 160;
/** Room inside a pattern's boundary (a panel) around its cells; the top holds its title. */
export const PATTERN_FRAME_PAD_X = 30;
export const PATTERN_FRAME_PAD_TOP = 56;
export const PATTERN_FRAME_PAD_BOTTOM = 30;
/** What an existing node with no stored size is taken to cover when placing a fragment. */
export const UNSIZED_NODE_EXTENT_W = 260;
export const UNSIZED_NODE_EXTENT_H = 120;
