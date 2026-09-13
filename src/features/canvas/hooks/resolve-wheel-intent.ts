import {
  WHEEL_LINE_HEIGHT_PX,
  WHEEL_PINCH_DELTA_BOOST,
  WHEEL_ZOOM_LINE_SCALE,
  WHEEL_ZOOM_PIXEL_SCALE,
} from "../canvas.constants";
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
  | { kind: "pan"; dx: number; dy: number }
  | { kind: "zoom"; factor: number };

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
 * Continuous zoom factor from a wheel delta, matching `@xyflow/system`'s `wheelDelta`
 * + `Math.pow(2, …)` path.
 *
 * Discrete ±1.1 steps felt fine for a mouse notch but sticky on a trackpad: pinch and
 * two-finger zoom emit many tiny `deltaY` values, and each one used to jump a full 10%.
 *
 * @example
 * // Trackpad pinch in (ctrlKey, deltaY ≈ -2.5) → ~1.035×
 * zoomFactorFromWheel({ deltaY: -2.5, deltaMode: 0, ctrlKey: true, … })
 */
export function zoomFactorFromWheel(event: WheelIntentInput): number {
  const modeScale =
    event.deltaMode === DOM_DELTA_LINE
      ? WHEEL_ZOOM_LINE_SCALE
      : event.deltaMode === DOM_DELTA_PAGE
        ? 1
        : WHEEL_ZOOM_PIXEL_SCALE;
  // Pinch synthesizes ctrlKey; Cmd/meta alone is an intentional modifier and stays unboosted.
  const pinchBoost = event.ctrlKey ? WHEEL_PINCH_DELTA_BOOST : 1;
  const wheelDelta = -event.deltaY * modeScale * pinchBoost;
  return Math.pow(2, wheelDelta);
}

/**
 * Decide what a wheel event means, draw.io style. Precedence, highest first:
 *
 * 1. `Ctrl`/`Cmd` → zoom. Browsers synthesize `ctrlKey` for a trackpad pinch, so this also
 *    covers pinch-to-zoom without having to identify the device.
 * 2. `Shift` → horizontal pan. Prefer `deltaY` (classic Shift+wheel remap); if the
 *    browser already converted the gesture to `deltaX` (common on macOS), use that.
 * 3. Otherwise the user's `scrollMode` preference decides, defaulting to pan.
 *
 * Panning follows the fingers: a downward two-finger swipe (`deltaY > 0`) moves the content up,
 * so the viewport translates by `-deltaY`. Zoom magnitude follows `|deltaY|` (continuous), not
 * a fixed per-event step.
 */
export function resolveWheelIntent(
  event: WheelIntentInput,
  scrollMode: CanvasScrollMode,
  paneHeight: number,
): WheelIntent {
  const dx = toPixels(event.deltaX, event.deltaMode, paneHeight);
  const dy = toPixels(event.deltaY, event.deltaMode, paneHeight);

  if (event.ctrlKey || event.metaKey) {
    return { kind: "zoom", factor: zoomFactorFromWheel(event) };
  }

  if (event.shiftKey) {
    // Chrome/Safari on macOS often remap Shift+vertical-wheel to deltaX with
    // deltaY === 0; Firefox keeps deltaY. Prefer the axis that actually moved.
    const horizontal = dy !== 0 ? dy : dx;
    return { kind: "pan", dx: horizontal, dy: 0 };
  }

  if (scrollMode === "zoom") {
    return { kind: "zoom", factor: zoomFactorFromWheel(event) };
  }

  return { kind: "pan", dx, dy };
}
