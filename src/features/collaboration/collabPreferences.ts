const STORAGE_KEY = "structura:collabPreferences";

export interface CollabPreferences {
  userName: string;
  signalingUrl: string;
}

const DEFAULTS: CollabPreferences = {
  userName: "",
  signalingUrl: import.meta.env.VITE_SIGNALING_URL ?? "ws://localhost:3000/ws",
};

export function readCollabPreferences(): CollabPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<CollabPreferences>;
    return {
      userName: parsed.userName ?? DEFAULTS.userName,
      signalingUrl: parsed.signalingUrl ?? DEFAULTS.signalingUrl,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writeCollabPreferences(preferences: Partial<CollabPreferences>): void {
  try {
    const currentPreferences = readCollabPreferences();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...currentPreferences, ...preferences }),
    );
  } catch {
    // Ignore localStorage errors.
  }
}
