import { useState, useCallback } from "react";
import type { DefectDojoConfig } from "../types";

const STORAGE_KEY = "structura:defectdojo:config";

export function useDefectDojoConfig() {
  const [config, setConfig] = useState<DefectDojoConfig | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as DefectDojoConfig) : null;
    } catch {
      return null;
    }
  });

  const saveConfig = useCallback((cfg: DefectDojoConfig) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
    setConfig(cfg);
  }, []);

  const clearConfig = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConfig(null);
  }, []);

  const isConfigured = Boolean(config?.baseUrl && config?.apiToken);

  return { config, saveConfig, clearConfig, isConfigured };
}
