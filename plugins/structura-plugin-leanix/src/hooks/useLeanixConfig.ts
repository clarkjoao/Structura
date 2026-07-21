import { useState, useEffect, useCallback } from "react";
import type { LeanixConfig } from "../types/config";

const CONFIG_KEY = "leanix_config";

/**
 * Global state that persists across all hook instances
 * This ensures all components share the same config state
 */
let globalConfig: LeanixConfig | null = null;
let globalIsConfigured = false;
const listeners = new Set<(config: LeanixConfig | null, isConfigured: boolean) => void>();

function notifyListeners() {
  listeners.forEach(listener => listener(globalConfig, globalIsConfigured));
}

/**
 * Hook to manage Leanix configuration via localStorage
 * Uses global state to ensure all components share the same config
 */
export function useLeanixConfig() {
  const [config, setConfig] = useState<LeanixConfig | null>(() => globalConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(globalIsConfigured);

  useEffect(() => {
    // Register as a listener for global state changes
    const handleChange = (newConfig: LeanixConfig | null, configured: boolean) => {
      setConfig(newConfig);
      setIsConfigured(configured);
    };
    listeners.add(handleChange);

    // Load config from localStorage if not already loaded
    if (globalConfig === null) {
      const loadConfig = () => {
        try {
          const stored = localStorage.getItem(CONFIG_KEY);
          if (stored) {
            globalConfig = JSON.parse(stored) as LeanixConfig;
            globalIsConfigured = true;
            notifyListeners();
          }
        } catch (e) {
          console.error("[Leanix Plugin] Failed to load config:", e);
        }
      };
      loadConfig();
    }

    setIsLoading(false);

    return () => {
      listeners.delete(handleChange);
    };
  }, []);

  const saveConfig = useCallback(async (newConfig: LeanixConfig): Promise<boolean> => {
    if (!newConfig.baseUrl?.trim()) return false;
    if (!newConfig.authToken?.trim()) return false;
    if (!newConfig.userId?.trim()) return false;
    if (newConfig.useProxy && !newConfig.proxyUrl?.trim()) return false;

    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));
      globalConfig = newConfig;
      globalIsConfigured = true;
      notifyListeners();
      return true;
    } catch (e) {
      console.error("[Leanix Plugin] Failed to save config:", e);
      return false;
    }
  }, []);

  const clearConfig = useCallback(async (): Promise<void> => {
    localStorage.removeItem(CONFIG_KEY);
    globalConfig = null;
    globalIsConfigured = false;
    notifyListeners();
  }, []);

  return { config, isLoading, isConfigured, saveConfig, clearConfig };
}
