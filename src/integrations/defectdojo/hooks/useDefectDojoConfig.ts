import { useState, useCallback } from "react";
import type { DefectDojoConfig } from "../types";
import { defaultStorage } from "@/infrastructure/persistence";

const STORAGE_KEY = "defectdojo:config";
const ADAPTER_KEY = `structura_${STORAGE_KEY}`;

/** Legacy key used before migration to defaultStorage */
const LEGACY_KEY = "structura:defectdojo:config";

export function useDefectDojoConfig() {
  const [config, setConfig] = useState<DefectDojoConfig | null>(() => {
    try {
      const raw =
        localStorage.getItem(ADAPTER_KEY) ??
        localStorage.getItem(LEGACY_KEY);
      return raw ? (JSON.parse(raw) as DefectDojoConfig) : null;
    } catch {
      return null;
    }
  });

  const saveConfig = useCallback(async (cfg: DefectDojoConfig) => {
    // forceSave bypasses the pause — credentials are NOT diagram data
    await defaultStorage.forceSave(STORAGE_KEY, cfg);
    setConfig(cfg);
  }, []);

  const clearConfig = useCallback(async () => {
    await defaultStorage.removeItem(STORAGE_KEY);
    // Also clean legacy key
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
    setConfig(null);
  }, []);

  const isConfigured = Boolean(config?.baseUrl && config?.apiToken);

  return { config, saveConfig, clearConfig, isConfigured };
}
