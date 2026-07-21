import { useState, useEffect, useCallback } from "react";
import { getApi } from "./usePluginApi";
import type { LeanixConfig } from "../types/config";

const CONFIG_KEY = "leanix_config";

/**
 * Hook to manage Leanix configuration via api.storage
 */
export function useLeanixConfig() {
  const [config, setConfig] = useState<LeanixConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);

  // Load config from storage on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const stored = await getApi().storage.get<LeanixConfig>(CONFIG_KEY);
        if (stored) {
          setConfig(stored);
          setIsConfigured(true);
        }
      } catch (error) {
        console.error("[Leanix Plugin] Failed to load config:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  /**
   * Save configuration
   */
  const saveConfig = useCallback(async (newConfig: LeanixConfig): Promise<boolean> => {
    try {
      // Validate required fields
      if (!newConfig.baseUrl?.trim()) {
        throw new Error("Base URL is required");
      }
      if (!newConfig.authToken?.trim()) {
        throw new Error("Auth token is required");
      }
      if (!newConfig.userId?.trim()) {
        throw new Error("User ID is required");
      }

      await getApi().storage.set(CONFIG_KEY, newConfig);
      setConfig(newConfig);
      setIsConfigured(true);
      return true;
    } catch (error) {
      console.error("[Leanix Plugin] Failed to save config:", error);
      return false;
    }
  }, []);

  /**
   * Clear configuration
   */
  const clearConfig = useCallback(async (): Promise<void> => {
    try {
      await getApi().storage.remove(CONFIG_KEY);
      setConfig(null);
      setIsConfigured(false);
    } catch (error) {
      console.error("[Leanix Plugin] Failed to clear config:", error);
    }
  }, []);

  return {
    config,
    isLoading,
    isConfigured,
    saveConfig,
    clearConfig,
  };
}
