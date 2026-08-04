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
const STORAGE_KEY = "structura:ir:applyElkWaypoints";

let override: boolean | null = null;

function readStoredFlag(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === "true";
  } catch {
    // Storage can be unavailable (SSR, private mode); the default is off.
    return false;
  }
}

export function isApplyElkWaypointsEnabled(): boolean {
  return override ?? readStoredFlag();
}

/** Overrides the stored value for this session. `null` restores it. */
export function setApplyElkWaypoints(value: boolean | null): void {
  override = value;
}
