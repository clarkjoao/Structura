import { useSyncExternalStore } from "react";
import { getApi } from "./usePluginApi";
import type { LeanixConfig } from "../types/config";

/**
 * Leanix configuration — a single module-level store shared across the whole plugin bundle.
 *
 * Why not React Context? The config UI spans two DISJOINT React subtrees: the toolbar panel
 * (rendered in the host's canvas-toolbar slot) and the settings modal (rendered by the host's
 * ModalOverlay, which is NOT a descendant of the panel). A Context Provider around the panel
 * can never reach the modal, so a modal `useContext` returns the default and the two ends drift
 * apart — saving in the modal wouldn't re-enable the panel's "send" button, and reopening the
 * modal could show stale/empty state.
 *
 * The plugin bundle is evaluated exactly once (see host plugin-loader `new Function(code)`), so
 * a module singleton IS shared by both subtrees. We expose it through `useSyncExternalStore`
 * (the same pattern the host uses for its overlay registry), so every consumer — panel or modal,
 * whatever the tree — reads one source of truth and re-renders on every change.
 */

const STORAGE_KEY = "leanix_config";

export interface LeanixConfigValue {
  config: LeanixConfig | null;
  isLoading: boolean;
  isConfigured: boolean;
  saveConfig: (config: LeanixConfig) => Promise<boolean>;
  clearConfig: () => Promise<void>;
}

interface ConfigState {
  config: LeanixConfig | null;
  isConfigured: boolean;
  isLoading: boolean;
}

// The single source of truth. Reassigned as a whole object on change so useSyncExternalStore's
// getSnapshot returns a stable reference between unrelated renders (no tearing / no loops).
let state: ConfigState = { config: null, isConfigured: false, isLoading: true };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function setState(next: Partial<ConfigState>): void {
  state = { ...state, ...next };
  emit();
}

// Lazy, one-time hydration from persistent storage. Runs when the first consumer subscribes.
let hydrated = false;
function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  getApi()
    .storage.get<string>(STORAGE_KEY)
    .then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as LeanixConfig;
          setState({ config: parsed, isConfigured: true, isLoading: false });
          return;
        } catch {
          // Corrupt value — fall through to the "not configured" state below.
        }
      }
      setState({ config: null, isConfigured: false, isLoading: false });
    })
    .catch((e) => {
      console.error("[Leanix Plugin] Failed to load config:", e);
      setState({ isLoading: false });
    });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  hydrate(); // idempotent; ensures storage is read as soon as anything mounts
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ConfigState {
  return state;
}

function isValid(cfg: LeanixConfig): boolean {
  if (!cfg.baseUrl?.trim()) return false;
  if (!cfg.authToken?.trim()) return false;
  if (!cfg.userId?.trim()) return false;
  if (cfg.useProxy && !cfg.proxyUrl?.trim()) return false;
  return true;
}

// Stable module-level actions — safe to use directly in effect/callback deps.
async function saveConfig(newConfig: LeanixConfig): Promise<boolean> {
  if (!isValid(newConfig)) return false;
  try {
    await getApi().storage.set(STORAGE_KEY, JSON.stringify(newConfig));
    setState({ config: newConfig, isConfigured: true, isLoading: false });
    return true;
  } catch (e) {
    console.error("[Leanix Plugin] Failed to save config:", e);
    return false;
  }
}

async function clearConfig(): Promise<void> {
  try {
    await getApi().storage.remove(STORAGE_KEY);
    setState({ config: null, isConfigured: false, isLoading: false });
  } catch (e) {
    console.error("[Leanix Plugin] Failed to clear config:", e);
  }
}

/**
 * Access the shared Leanix configuration. Works identically in any subtree — the toolbar panel
 * and the settings modal both read/write the same store, so a save on one side is immediately
 * reflected on the other.
 */
export function useLeanixConfig(): LeanixConfigValue {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    config: snapshot.config,
    isLoading: snapshot.isLoading,
    isConfigured: snapshot.isConfigured,
    saveConfig,
    clearConfig,
  };
}
