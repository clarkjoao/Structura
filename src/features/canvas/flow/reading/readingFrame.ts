import type { Flow, FlowStep } from "@/features/diagram";

/**
 * How the canvas follows a reading.
 *
 * It used to fit the step's own node at up to 1.5×, on every step. A step on one node therefore
 * always landed at maximum zoom, with the node it was called from and the one it calls next off
 * screen — the reader saw a giant box and none of the conversation it is part of. And the camera
 * moved on every step, even when the next node was already in plain view.
 *
 * Now: frame the step with its neighbours (where it came from, where it goes) at a reading zoom;
 * if that needs zooming out too far, frame the step alone; if even the step is too long to read
 * at once (a call across the whole diagram), frame the node it lands on; and if the step is
 * already comfortably on screen at a readable zoom, do not move at all.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** Never closer than this while reading: a node is legible at 1×, and its neighbours fit. */
export const READING_MAX_ZOOM = 1;
/** Further out than this, labels stop being readable; the step is then framed alone. */
export const READING_MIN_ZOOM = 0.6;
export const READING_PADDING = 0.2;
/** How far inside the pane edges a step must sit to count as "already in view", in px. */
const IN_VIEW_MARGIN = 48;

export type ReadingFramePlan = { kind: "stay" } | { kind: "fit"; bounds: Rect };

/** The zoom a fit of `bounds` into the pane would need, before any clamping. */
function zoomToFit(bounds: Rect, pane: { width: number; height: number }, padding: number) {
  const width = bounds.width * (1 + 2 * padding);
  const height = bounds.height * (1 + 2 * padding);
  if (width <= 0 || height <= 0) return Number.POSITIVE_INFINITY;
  return Math.min(pane.width / width, pane.height / height);
}

function unionRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function isComfortablyInView(
  bounds: Rect,
  viewport: Viewport,
  pane: { width: number; height: number },
): boolean {
  if (viewport.zoom < READING_MIN_ZOOM || viewport.zoom > READING_MAX_ZOOM * 1.25) return false;
  const left = bounds.x * viewport.zoom + viewport.x;
  const top = bounds.y * viewport.zoom + viewport.y;
  const right = left + bounds.width * viewport.zoom;
  const bottom = top + bounds.height * viewport.zoom;
  return (
    left >= IN_VIEW_MARGIN &&
    top >= IN_VIEW_MARGIN &&
    right <= pane.width - IN_VIEW_MARGIN &&
    bottom <= pane.height - IN_VIEW_MARGIN
  );
}

/**
 * Decides where the camera goes for one step.
 *
 * `step` is the bounds of what the step points at; `context` adds its neighbours. The plan is
 * the bounds to fit — clamped by the caller to the reading zooms — or "stay".
 */
export function planReadingFrame({
  step,
  focus,
  context,
  viewport,
  pane,
}: {
  step: Rect;
  /** The node the step happens on — what the scene names after "on". */
  focus: Rect;
  context: Rect | null;
  viewport: Viewport;
  pane: { width: number; height: number };
}): ReadingFramePlan {
  if (pane.width <= 0 || pane.height <= 0) return { kind: "fit", bounds: step };
  if (isComfortablyInView(step, viewport, pane)) return { kind: "stay" };
  const readable = (bounds: Rect) => zoomToFit(bounds, pane, READING_PADDING) >= READING_MIN_ZOOM;
  const withContext = context ? unionRect([step, context]) : null;
  if (withContext && readable(withContext)) return { kind: "fit", bounds: withContext };
  if (readable(step)) return { kind: "fit", bounds: step };
  if (isComfortablyInView(focus, viewport, pane)) return { kind: "stay" };
  return { kind: "fit", bounds: focus };
}

/**
 * The steps beside `stepId` in the script: the ones that lead to it and the one it leads to.
 * Structural, not the reader's path, so the viewer — which holds no history here — frames the
 * same way the editor does.
 */
export function neighbourSteps(flow: Flow, stepId: string): FlowStep[] {
  const step = flow.steps[stepId];
  const before = Object.values(flow.steps).filter(
    (candidate) =>
      candidate.next === stepId ||
      (candidate.branches ?? []).some((branch) => branch.nextId === stepId),
  );
  const after = step?.next ? flow.steps[step.next] : undefined;
  return [...before.slice(0, 1), ...(after ? [after] : [])];
}
