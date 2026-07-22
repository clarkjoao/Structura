import type { LeanixConfig } from "../types/config";
import { getReact } from "./usePluginApi";

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
 * Load config from localStorage
 */
function loadConfigFromStorage(): void {
  if (globalConfig !== null) return; // Already loaded

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
}

/**
 * Hook to manage Leanix configuration via localStorage
 * Uses global state to ensure all components share the same config
 * Uses the host's React via getReact()
 */
export function useLeanixConfig() {
  const React = getReact();

  // Initialize state with current global values
  const [config, setConfig] = React.useState<LeanixConfig | null>(() => {
    loadConfigFromStorage();
    return globalConfig;
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isConfigured, setIsConfigured] = React.useState(globalIsConfigured);

  // Listen for global state changes
  React.useEffect(() => {
    const handleChange = (newConfig: LeanixConfig | null, configured: boolean) => {
      setConfig(newConfig);
      setIsConfigured(configured);
    };
    listeners.add(handleChange);
    setIsLoading(false);

    return () => {
      listeners.delete(handleChange);
    };
  }, [React]);

  const saveConfig = React.useCallback(async (newConfig: LeanixConfig): Promise<boolean> => {
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

  const clearConfig = React.useCallback(async (): Promise<void> => {
    localStorage.removeItem(CONFIG_KEY);
    globalConfig = null;
    globalIsConfigured = false;
    notifyListeners();
  }, []);

  return { config, isLoading, isConfigured, saveConfig, clearConfig };
}
