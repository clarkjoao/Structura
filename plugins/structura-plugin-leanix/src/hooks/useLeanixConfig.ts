import { useState, useEffect, useCallback } from "react";
import type { LeanixConfig } from "../types/config";

const CONFIG_KEY = "leanix_config";

/**
 * Hook to manage Leanix configuration via localStorage
 */
export function useLeanixConfig() {
  const [config, setConfig] = useState<LeanixConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    const loadConfig = () => {
      try {
        const stored = localStorage.getItem(CONFIG_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as LeanixConfig;
          setConfig(parsed);
          setIsConfigured(true);
        }
      } catch (e) {
        console.error("[Leanix Plugin] Failed to load config:", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadConfig();
  }, []);

  const saveConfig = useCallback(async (newConfig: LeanixConfig): Promise<boolean> => {
    if (!newConfig.baseUrl?.trim()) return false;
    if (!newConfig.authToken?.trim()) return false;
    if (!newConfig.userId?.trim()) return false;

    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));
      setConfig(newConfig);
      setIsConfigured(true);
      return true;
    } catch (e) {
      console.error("[Leanix Plugin] Failed to save config:", e);
      return false;
    }
  }, []);

  const clearConfig = useCallback(async (): Promise<void> => {
    localStorage.removeItem(CONFIG_KEY);
    setConfig(null);
    setIsConfigured(false);
  }, []);

  return { config, isLoading, isConfigured, saveConfig, clearConfig };
}
