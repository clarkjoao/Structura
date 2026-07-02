const KEY = "structura:collab";

interface CollabPrefs {
  userName: string;
  serverUrl: string;
}

const DEFAULTS: CollabPrefs = {
  userName: "",
  serverUrl: `ws://${window.location.hostname}:3000/ws`,
};

export function readPrefs(): CollabPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writePrefs(prefs: Partial<CollabPrefs>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readPrefs(), ...prefs }));
  } catch {}
}

export type { CollabPrefs };
