import { WHEEL_LINE_HEIGHT_PX, WHEEL_ZOOM_FACTOR } from "../canvas.constants";
import type { CanvasScrollMode } from "../preferences";

/** The subset of `WheelEvent` the resolver reads, so it can be unit-tested without a DOM. */
export interface WheelIntentInput {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export type WheelIntent =
  { kind: "pan"; dx: number; dy: number } | { kind: "zoom"; factor: number };

/** `WheelEvent.DOM_DELTA_*` are instance constants, unavailable when the event is a plain object. */
const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

/**
 * Wheel deltas arrive in three units depending on the device and the platform. Without
 * normalising, a mouse reporting line deltas pans three pixels per notch.
 */
function toPixels(delta: number, deltaMode: number, paneHeight: number): number {
  switch (deltaMode) {
    case DOM_DELTA_LINE:
      return delta * WHEEL_LINE_HEIGHT_PX;
    case DOM_DELTA_PAGE:
      return delta * paneHeight;
    case DOM_DELTA_PIXEL:
    default:
      return delta;
  }
}

/**
 * Decide what a wheel event means, draw.io style. Precedence, highest first:
 *
 * 1. `Ctrl`/`Cmd` → zoom. Browsers synthesize `ctrlKey` for a trackpad pinch, so this also
 *    covers pinch-to-zoom without having to identify the device.
 * 2. `Shift` → horizontal pan, driven by `deltaY` the way every scrollable surface does it.
 * 3. Otherwise the user's `scrollMode` preference decides, defaulting to pan.
 *
 * Panning follows the fingers: a downward two-finger swipe (`deltaY > 0`) moves the content up,
 * so the viewport translates by `-deltaY`.
 */
export function resolveWheelIntent(
  event: WheelIntentInput,
  scrollMode: CanvasScrollMode,
  paneHeight: number,
): WheelIntent {
  const dx = toPixels(event.deltaX, event.deltaMode, paneHeight);
  const dy = toPixels(event.deltaY, event.deltaMode, paneHeight);

  if (event.ctrlKey || event.metaKey) {
    return { kind: "zoom", factor: dy > 0 ? 1 / WHEEL_ZOOM_FACTOR : WHEEL_ZOOM_FACTOR };
  }

  if (event.shiftKey) {
    return { kind: "pan", dx: dy, dy: 0 };
  }

  if (scrollMode === "zoom") {
    return { kind: "zoom", factor: dy > 0 ? 1 / WHEEL_ZOOM_FACTOR : WHEEL_ZOOM_FACTOR };
  }

  return { kind: "pan", dx, dy };
}
