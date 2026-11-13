import {
  kvSessionGetItem,
  kvSessionRemoveItem,
  kvSessionSetItem,
} from "@/infrastructure/persistence/kvStorage";

/**
 * The host's hold on a live session, kept in `sessionStorage`: it survives a reload of the host's
 * tab (which reconnects as host within the grace period) and dies with the tab, so a second tab or
 * another browser can never act as host.
 */

export interface StoredHostSession {
  roomId: string;
  hostToken: string;
  serverUrl: string;
  userName: string;
  userId: string;
  color: string;
}

const key = (diagramId: string) => `structura:collab-host:${diagramId}`;

function isStoredHostSession(value: unknown): value is StoredHostSession {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.roomId === "string" &&
    typeof v.hostToken === "string" &&
    typeof v.serverUrl === "string" &&
    typeof v.userName === "string" &&
    typeof v.userId === "string" &&
    typeof v.color === "string"
  );
}

export function readHostSession(diagramId: string): StoredHostSession | null {
  try {
    const raw = kvSessionGetItem(key(diagramId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredHostSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeHostSession(diagramId: string, session: StoredHostSession): void {
  try {
    kvSessionSetItem(key(diagramId), JSON.stringify(session));
  } catch {
    // Storage unavailable: a reload ends the session instead of resuming it.
  }
}

export function clearHostSession(diagramId: string): void {
  try {
    kvSessionRemoveItem(key(diagramId));
  } catch {
    // Nothing to clear.
  }
}
