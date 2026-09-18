/**
 * Opacities the canvas dims nodes and edges with. A leaf module — no imports —
 * so the pure projection (`core/projectDiagram.ts`) can read them without
 * pulling `canvas.constants`, which re-exports the diagram barrel.
 */
export const OPACITY_TAG_FILTER_DIM = 0.15;

export const OPACITY_TAG_FILTER_TRANSITION = "opacity 0.2s ease";

export const OPACITY_FLOW_PLAYBACK_EDGE_DIM = 0.2;

/**
 * A call made and not yet answered: brighter than the flow's other edges,
 * dimmer than the step in hand. It is the reading's stack, on the picture.
 */
export const OPACITY_FLOW_PLAYBACK_IN_FLIGHT = 0.8;

export const OPACITY_FLOW_PLAYBACK_PARTICIPANT = 0.5;

export const OPACITY_TAG_FILTER_EDGE_DIM = 0.1;

export const OPACITY_FLOW_PLAYBACK_NODE_DIM = 0.3;
