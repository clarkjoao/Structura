/**
 * Actions the user takes on plugin-owned Versions (merge, rename, delete, create), delivered to
 * the owning plugin instead of changing the store: the plugin's own source (an opscr folder) is
 * the truth, and it writes the Versions back through `api.versions.upsert`.
 */
import type { PluginVersionAction } from "./plugin.types";

type Handler = (action: PluginVersionAction) => void;

const handlers = new Map<string, Set<Handler>>();

/** Registers a plugin's handler. Returns unsubscribe. */
export function onVersionAction(pluginId: string, handler: Handler): () => void {
  const set = handlers.get(pluginId) ?? new Set<Handler>();
  set.add(handler);
  handlers.set(pluginId, set);
  return () => {
    set.delete(handler);
    if (set.size === 0) handlers.delete(pluginId);
  };
}

/** Whether the plugin listens for actions on its Versions. */
export function pluginHandlesVersionActions(pluginId: string): boolean {
  return (handlers.get(pluginId)?.size ?? 0) > 0;
}

/** Delivers the action to the plugin's handlers; false when it has none. */
export function deliverVersionAction(pluginId: string, action: PluginVersionAction): boolean {
  const set = handlers.get(pluginId);
  if (!set || set.size === 0) return false;
  for (const handler of [...set]) {
    try {
      handler(action);
    } catch (error) {
      console.error(`[plugins] ${pluginId} version action handler threw:`, error);
    }
  }
  return true;
}
