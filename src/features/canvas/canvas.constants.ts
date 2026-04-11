/** Opacity of elements out of focus (tag filter). */
export const OPACITY_TAG_FILTER_DIM = 0.15;

/** Flow playback: edges not active (and recording: edges not yet recorded). */
export const OPACITY_FLOW_PLAYBACK_EDGE_DIM = 0.2;
/** Flow playback: edges (and C4 nodes) in the current step’s participant set. */
export const OPACITY_FLOW_PLAYBACK_PARTICIPANT = 0.5;
/** Tag filter: edge dim when an endpoint is hidden by tag filter. */
export const OPACITY_TAG_FILTER_EDGE_DIM = 0.1;

/** Flow playback: nodes dimmed when not in the highlighted set. */
export const OPACITY_FLOW_PLAYBACK_NODE_DIM = 0.3;

/** CustomEdge: segment guide stroke when selected/hovered. */
export const EDGE_SEGMENT_HIGHLIGHT_STROKE_OPACITY = 0.35;

/** Animated fit (e.g. flow step focus). */
export const FIT_VIEW_DURATION_MS = 400;
export const FIT_VIEW_PADDING = 0.35;
export const FIT_VIEW_MAX_ZOOM = 1.5;

/** Initial diagram fit + wheel zoom clamp (tighter than step highlight fit). */
export const VIEWPORT_MIN_ZOOM = 0.3;
export const FIT_VIEW_INITIAL_PADDING = 0.3;

/** File system sync debounce after store updates. */
export { VIEWPORT_DEBOUNCE_MS } from "@/features/diagram";
/** Element / connection field edits in panels. */
export const FIELD_DEBOUNCE_MS = 300;

/** Maximum number of history steps to store. */
export { MAX_HISTORY_STEPS } from "@/features/diagram";
/** Time to wait before coalescing history entries. */
export { HISTORY_COALESCE_MS } from "@/features/diagram";
/** Time to wait before allowing a new undo/redo operation after a previous one. */
export { UNDO_REDO_COOLDOWN_MS } from "@/features/diagram";

/** Duration of flow particle animation (re-exported from leaf module — safe under circular loads). */
export { FLOW_PARTICLE_DURATION_MS } from "./flowParticle.constants";
