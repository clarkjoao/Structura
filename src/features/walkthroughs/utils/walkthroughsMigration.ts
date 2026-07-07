/**
 * Forward-only migration of the walkthroughs store's localStorage key.
 *
 * Before schema version 9 the key was "structura:journeys". With the
 * Journey -> Walkthrough rename it became "structura:walkthroughs". This
 * module copies any existing legacy entry to the new key on startup and
 * drops the old one. Idempotent: if the new key is already present, the
 * legacy entry is dropped without overwriting the user's data.
 *
 * The migration is a separate module rather than a slice action because
 * it runs once at boot, before React mounts, and is not part of the
 * zustand store's transactional history.
 */

const LEGACY_KEY = "structura:journeys";
const CURRENT_KEY = "structura:walkthroughs";

export function migrateWalkthroughsLocalStorageKey(): void {
  if (typeof window === "undefined" || !window.localStorage) return;

  const current = window.localStorage.getItem(CURRENT_KEY);
  const legacy = window.localStorage.getItem(LEGACY_KEY);

  if (legacy === null) return;

  if (current === null) {
    window.localStorage.setItem(CURRENT_KEY, legacy);
  }
  window.localStorage.removeItem(LEGACY_KEY);
}
