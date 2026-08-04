/**
 * Runtime switch for the ELK-waypoint experiment (Fatia 4).
 *
 * The canvas normally routes generated connections itself; with this on, the
 * bend points ELK computed are stored as the connection's control points so
 * ELK's crossing-minimised route is what gets drawn.
 *
 * It is readable and writable at runtime — from a test, or from the browser
 * console via `localStorage` — so both modes can be measured and eyeballed
 * without a rebuild:
 *
 *   localStorage.setItem("structura:ir:applyElkWaypoints", "true")
 */
const WAYPOINTS_KEY = "structura:ir:applyElkWaypoints";
const HANDLE_ORDER_KEY = "structura:ir:applyElkHandleOrder";

let waypointsOverride: boolean | null = null;
let handleOrderOverride: boolean | null = null;

function readStoredFlag(key: string): boolean {
  try {
    return globalThis.localStorage?.getItem(key) === "true";
  } catch {
    // Storage can be unavailable (SSR, private mode); the default is off.
    return false;
  }
}

export function isApplyElkWaypointsEnabled(): boolean {
  return waypointsOverride ?? readStoredFlag(WAYPOINTS_KEY);
}

/** Overrides the stored value for this session. `null` restores it. */
export function setApplyElkWaypoints(value: boolean | null): void {
  waypointsOverride = value;
}

/**
 * Writes ELK's edge ordering into each generated node's `handleOrder`, so the
 * canvas picks handles in the order ELK worked out instead of round-robin.
 *
 * **On by default** — measured at 52 -> 16 rendered crossings across the four
 * reference diagrams, with no metric getting worse. Opt out for comparison:
 *
 *   localStorage.setItem("structura:ir:applyElkHandleOrder", "false")
 */
export function isApplyElkHandleOrderEnabled(): boolean {
  if (handleOrderOverride !== null) return handleOrderOverride;
  try {
    return globalThis.localStorage?.getItem(HANDLE_ORDER_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setApplyElkHandleOrder(value: boolean | null): void {
  handleOrderOverride = value;
}
