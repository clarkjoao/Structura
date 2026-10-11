const KEY = "structura:collab";

interface CollabPrefs {
  userName: string;
  serverUrl: string;
}

/**
 * Build the default collaboration server URL from the page the app is hosted on.
 *
 *   https://ws.structur.dev/ws  →  wss://ws.structur.dev/ws     (same host, no port)
 *   http://example.com          →  ws://example.com:3000/ws     (assume the relay default port)
 *   http://localhost:8080       →  ws://localhost:3000/ws       (vite dev → relay on 3000)
 *
 * Insecure pages keep the explicit `:3000` because the relay listens there by
 * default; secure pages drop the port because WSS runs on 443 next to the app.
 */
function defaultServerUrl(): string {
  if (typeof window === "undefined") return "ws://localhost:3000/ws";

  const { protocol, hostname } = window.location;
  const isSecure = protocol === "https:";

  if (isSecure) {
    return `wss://${hostname}/ws`;
  }

  const port = ":3000"; // relay default; explicit so a page served on :80 still hits the relay port
  return `ws://${hostname}${port}/ws`;
}

const DEFAULTS: CollabPrefs = {
  userName: "",
  serverUrl: defaultServerUrl(),
};

export function readPrefs(): CollabPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS, serverUrl: defaultServerUrl() };
    const parsed = JSON.parse(raw) as Partial<CollabPrefs>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return { ...DEFAULTS, serverUrl: defaultServerUrl() };
  }
}

export function writePrefs(prefs: Partial<CollabPrefs>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readPrefs(), ...prefs }));
  } catch (err) {
    console.warn("[collab-preferences] Failed to write preferences:", err);
  }
}

export type { CollabPrefs };
