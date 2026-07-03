import type { IStoragePort } from "@/infrastructure/persistence";
import { defaultStorage } from "@/infrastructure/persistence";
import type { PluginStorage } from "./plugin.types";

/**
 * Plugin-scoped persistent storage: keys namespaced "plugin:<pluginId>:<key>", backed by
 * IStoragePort. A per-plugin key index ("__keys") makes the namespace enumerable so
 * uninstall can delete it — the port has no key listing.
 */

const dataKey = (pluginId: string, key: string) => `plugin:${pluginId}:${key}`;
const indexKey = (pluginId: string) => `plugin:${pluginId}:__keys`;

async function readIndex(port: IStoragePort, pluginId: string): Promise<string[]> {
  const keys = await port.load<string[]>(indexKey(pluginId));
  return Array.isArray(keys) ? keys.filter((k) => typeof k === "string") : [];
}

export function createPluginStorage(
  pluginId: string,
  port: IStoragePort = defaultStorage,
): PluginStorage {
  return {
    async get<T>(key: string): Promise<T | null> {
      return port.load<T>(dataKey(pluginId, key));
    },

    async set<T>(key: string, value: T): Promise<void> {
      await port.save(dataKey(pluginId, key), value);
      const keys = await readIndex(port, pluginId);
      if (!keys.includes(key)) {
        await port.save(indexKey(pluginId), [...keys, key]);
      }
    },

    async remove(key: string): Promise<void> {
      await port.delete(dataKey(pluginId, key));
      const keys = await readIndex(port, pluginId);
      if (keys.includes(key)) {
        await port.save(
          indexKey(pluginId),
          keys.filter((k) => k !== key),
        );
      }
    },
  };
}

/** Delete every key in the plugin's namespace, including the index itself (uninstall). */
export async function deletePluginStorageNamespace(
  pluginId: string,
  port: IStoragePort = defaultStorage,
): Promise<void> {
  const keys = await readIndex(port, pluginId);
  for (const key of keys) {
    await port.delete(dataKey(pluginId, key));
  }
  await port.delete(indexKey(pluginId));
}
