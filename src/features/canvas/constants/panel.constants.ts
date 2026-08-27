/**
 * Panel and Group component constants
 */

export const DEFAULT_PANEL_OPACITY = 10;
export const MIN_PANEL_WIDTH = 200;
export const MIN_PANEL_HEIGHT = 150;

/**
 * Width, in CSS pixels, of the `.panel-border` hit ring on an expanded panel.
 *
 * This is a CLICK TARGET, not a stroke. The drawn border stays at 2 px
 * (`border: 2px <style> <color>` on the panel container); the ring that
 * selects and drags the panel is 8 px measured inward from that stroke.
 * Rationale for the target being 4× the stroke: at 2 px, "grab the panel by
 * its edge" is a pixel hunt — the product owner's original complaint was
 * about gestures landing on the wrong thing, and a 2 px target is the same
 * class of problem. 8 px is still well inside the 200×150 minimum panel size,
 * so the ring of a panel never swallows a sibling panel's interior.
 *
 * Read by `PanelNode.tsx` (the four ring strips) and quoted by the precedence
 * table in `selection/pointerFunnel.ts`.
 */
export const PANEL_BORDER_HIT_PX = 8;
