import { useCallback, useState } from "react";
import type { GithubConfig } from "../github.types";
import { defaultStorage } from "@/infrastructure/persistence";

const STORAGE_KEY = "github:config";
const ADAPTER_KEY = `structura_${STORAGE_KEY}`;

export function useGithubConfig() {
  const [config, setConfig] = useState<GithubConfig | null>(() => {
    try {
      const raw = localStorage.getItem(ADAPTER_KEY);
      return raw ? (JSON.parse(raw) as GithubConfig) : null;
    } catch {
      return null;
    }
  });

  const saveConfig = useCallback(async (cfg: GithubConfig) => {
    // forceSave bypasses the pause — credentials are NOT diagram data
    await defaultStorage.forceSave(STORAGE_KEY, cfg);
    setConfig(cfg);
  }, []);

  const clearConfig = useCallback(async () => {
    await defaultStorage.removeItem(STORAGE_KEY);
    setConfig(null);
  }, []);

  const isConfigured = Boolean(config?.baseUrl && config?.token);

  return { config, saveConfig, clearConfig, isConfigured };
}

