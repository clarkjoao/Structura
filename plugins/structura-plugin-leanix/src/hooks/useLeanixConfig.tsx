import { createContext, useContext, useState, useEffect, useCallback, useId, type ReactNode } from "react";
import { getApi } from "./usePluginApi";
import type { LeanixConfig } from "../types/config";

/**
 * Leanix configuration context - provides shared state across all components.
 * This ensures the modal and panel stay in sync after saving/clearing.
 */
interface LeanixConfigContextValue {
  config: LeanixConfig | null;
  isLoading: boolean;
  isConfigured: boolean;
  saveConfig: (config: LeanixConfig) => Promise<boolean>;
  clearConfig: () => Promise<void>;
}

const LeanixConfigContext = createContext<LeanixConfigContextValue | null>(null);

// Track which instance is responsible for loading (prevent duplicate loads)
let loadingInstanceId: string | null = null;
let loadPromise: Promise<void> | null = null;

/**
 * Provider component - should wrap the plugin.
 * Only the first instance will load from storage; others will wait.
 */
export function LeanixConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<LeanixConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  // Generate a unique instance ID for this render
  const instanceId = useId() || Math.random().toString(36);

  // Initial load from storage (only one instance should do this)
  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      // If another instance is already loading, wait for it
      if (loadPromise) {
        try {
          await loadPromise;
        } catch {
          // Ignore errors from other instance
        }
        if (cancelled) return;
        // After waiting, read from storage (the loading instance updated the state)
        try {
          const raw = await getApi().storage.get<string>("leanix_config");
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
          } else {
            setConfig(null);
            setIsConfigured(false);
          }
        } catch (e) {
          if (cancelled) return;
          console.error("[Leanix Plugin] Failed to load config:", e);
        }
        setIsLoading(false);
        return;
      }

      // This instance is responsible for loading
      loadingInstanceId = instanceId;

      const doLoad = async () => {
        try {
          const raw = await getApi().storage.get<string>("leanix_config");
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
          } else {
            setConfig(null);
            setIsConfigured(false);
          }
        } catch (e) {
          if (cancelled) return;
          console.error("[Leanix Plugin] Failed to load config:", e);
        } finally {
          if (!cancelled) {
            setIsLoading(false);
            loadingInstanceId = null;
            loadPromise = null;
          }
        }
      };

      loadPromise = doLoad();
      await loadPromise;
    };

    loadConfig();
    return () => {
      cancelled = true;
      if (loadingInstanceId === instanceId) {
        loadingInstanceId = null;
        loadPromise = null;
      }
    };
  }, [instanceId]);

  const saveConfig = useCallback(async (newConfig: LeanixConfig): Promise<boolean> => {
    // Validate
    if (!newConfig.baseUrl?.trim()) return false;
    if (!newConfig.authToken?.trim()) return false;
    if (!newConfig.userId?.trim()) return false;
    if (newConfig.useProxy && !newConfig.proxyUrl?.trim()) return false;

    try {
      await getApi().storage.set("leanix_config", JSON.stringify(newConfig));
      // Update shared state - all subscribers will re-render
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

  const value: LeanixConfigContextValue = {
    config,
    isLoading,
    isConfigured,
    saveConfig,
    clearConfig,
  };

  return (
    <LeanixConfigContext.Provider value={value}>
      {children}
    </LeanixConfigContext.Provider>
  );
}

/**
 * Hook to access Leanix configuration.
 * Must be used within a LeanixConfigProvider.
 */
export function useLeanixConfig(): LeanixConfigContextValue {
  const context = useContext(LeanixConfigContext);
  // Always call the fallback hook - it handles the case where context is null
  const fallbackValue = useFallbackHook();
  return context ?? fallbackValue;
}

/**
 * Fallback hook for backwards compatibility when used outside provider.
 * Uses module-level state that persists across instances.
 */
let fallbackConfig: LeanixConfig | null = null;
let fallbackIsConfigured = false;

function useFallbackHook(): LeanixConfigContextValue {
  const [config, setConfig] = useState<LeanixConfig | null>(fallbackConfig);
  const [isConfigured, setIsConfigured] = useState(fallbackIsConfigured);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getApi().storage.get<string>("leanix_config").then((raw) => {
      if (cancelled) return;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as LeanixConfig;
          fallbackConfig = parsed;
          fallbackIsConfigured = true;
          setConfig(parsed);
          setIsConfigured(true);
        } catch {
          fallbackConfig = null;
          fallbackIsConfigured = false;
          setConfig(null);
          setIsConfigured(false);
        }
      } else {
        fallbackConfig = null;
        fallbackIsConfigured = false;
        setConfig(null);
        setIsConfigured(false);
      }
      setIsLoading(false);
    }).catch(() => {
      if (!cancelled) setIsLoading(false);
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
      fallbackConfig = newConfig;
      fallbackIsConfigured = true;
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
      fallbackConfig = null;
      fallbackIsConfigured = false;
      setConfig(null);
      setIsConfigured(false);
    } catch (e) {
      console.error("[Leanix Plugin] Failed to clear config:", e);
    }
  }, []);

  return { config, isLoading, isConfigured, saveConfig, clearConfig };
}
