/**
 * Selection epic — Phase 4: drag threshold constant.
 *
 * The threshold is measured in raw pointer screen coordinates, BEFORE any
 * React Flow or `snapGrid` quantisation. The previous implementation in
 * `useLocalNodes.ts` compared `change.position`, which RF emits post-snap —
 * so the distance was always 0 or ≥ `snapGrid`, never 1..14. That bug is
 * what motivated the move to a global pointer listener.
 *
 * The same constant is reused for the right-button gesture in
 * `pointerFunnel.ts`: below the threshold, a right-click is treated as a
 * press (context menu on release); above, it is treated as a drag (pan).
 * One threshold keeps the user from having to learn two.
 */
export const DRAG_THRESHOLD_PX = 4;

/** Squared-distance form — avoids `Math.sqrt` on every pointermove. */
export const DRAG_THRESHOLD_PX_SQUARED = DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX;

/** Raw pointer-distance helper (returns true when ≥ threshold). */
export function isDrag(dx: number, dy: number): boolean {
  return dx * dx + dy * dy >= DRAG_THRESHOLD_PX_SQUARED;
}
