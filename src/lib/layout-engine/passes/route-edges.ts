/**
 * P7 — orthogonal edge routing with waypoints.
 *
 * Stub: computes no waypoints or routing. Full implementation:
 * - direct: adjacent columns, vertical alignment within tolerance
 * - gutter: adjacent columns, no alignment → vertical channel in the gutter
 * - forward-lane: edge skips ≥2 columns → rises to reserved lane above the flow
 * - return-lane: edge goes backward → falls to reserved lane below the flow
 * - suppressed: endpoint in cross-cutting tier → no waypoints, no drawn arrow
 *
 * Lanes are stored in state.lanes for normalizeOrigin to translate.
 * Waypoints are written on LayoutConnection for the renderer to consume.
 */
import { cloneState, type LayoutPass } from "../types";

export const routeEdges: LayoutPass = (input) => cloneState(input);
