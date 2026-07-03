import { useSyncExternalStore } from "react";
import {
  getPluginRegistrySnapshot,
  subscribePluginRegistry,
  type PluginRuntimeState,
} from "../plugin-registry";

/**
 * React binding for plugin state. The plugin registry (plugin-registry.ts) is the single
 * source of truth for install records and lifecycle; mirroring it into a Zustand slice
 * would just create a second copy to keep in sync, so the UI subscribes directly.
 */
export function usePluginRegistry(): PluginRuntimeState[] {
  return useSyncExternalStore(subscribePluginRegistry, getPluginRegistrySnapshot);
}
