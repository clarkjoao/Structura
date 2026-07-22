import { useState, useEffect, useCallback } from "react";
import { getApi } from "./usePluginApi";
import type { LeanixConfig } from "../types/config";

/**
 * Persist Leanix configuration via the host's sanctioned api.storage interface.
 * Falls back to a module-level in-memory cache so reads are synchronous and
 * instant even before the first async load resolves.
 */
export function useLeanixConfig() {
  const [config, setConfig] = useState<LeanixConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  // Async initial load from storage
  useEffect(() => {
    let cancelled = false;
    getApi().storage.get<string>("leanix_config").then((raw) => {
      if (cancelled) return;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as LeanixConfig;
          setConfig(parsed);
          setIsConfigured(true);
        } catch {
          setConfig(null);
          setIsConfigured(false);
        }
      }
      setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const saveConfig = useCallback(async (newConfig: LeanixConfig): Promise<boolean> => {
    if (!newConfig.baseUrl?.trim()) return false;
    if (!newConfig.authToken?.trim()) return false;
    if (!newConfig.userId?.trim()) return false;
    if (newConfig.useProxy && !newConfig.proxyUrl?.trim()) return false;

    try {
      await getApi().storage.set("leanix_config", JSON.stringify(newConfig));
      setConfig(newConfig);
      setIsConfigured(true);
      return true;
    } catch (e) {
      console.error("[Leanix Plugin] Failed to save config:", e);
      return false;
    }
  }, []);

  const clearConfig = useCallback(async (): Promise<void> => {
    try {
      await getApi().storage.remove("leanix_config");
      setConfig(null);
      setIsConfigured(false);
    } catch (e) {
      console.error("[Leanix Plugin] Failed to clear config:", e);
    }
  }, []);

  return { config, isLoading, isConfigured, saveConfig, clearConfig };
}
