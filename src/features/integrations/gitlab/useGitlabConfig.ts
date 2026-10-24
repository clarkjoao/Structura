import { useCallback, useState } from "react";
import { defaultStorage } from "@/infrastructure/persistence";
import type { GitlabConfig } from "./gitlab.types";

const STORAGE_KEY = "gitlab:config";
const ADAPTER_KEY = `structura_${STORAGE_KEY}`;

export const DEFAULT_GITLAB_CONFIG: GitlabConfig = { baseUrl: "https://gitlab.com", token: "" };

/** Stored GitLab connection, read the same way as the GitHub one. */
export function readGitlabConfig(): GitlabConfig | null {
  try {
    const raw = localStorage.getItem(ADAPTER_KEY);
    return raw ? (JSON.parse(raw) as GitlabConfig) : null;
  } catch {
    return null;
  }
}

export function useGitlabConfig() {
  const [config, setConfig] = useState<GitlabConfig | null>(readGitlabConfig);

  const saveConfig = useCallback(async (cfg: GitlabConfig) => {
    await defaultStorage.forceSave(STORAGE_KEY, cfg);
    setConfig(cfg);
  }, []);

  const clearConfig = useCallback(async () => {
    await defaultStorage.removeItem(STORAGE_KEY);
    setConfig(null);
  }, []);

  return {
    config,
    saveConfig,
    clearConfig,
    isConfigured: Boolean(config?.baseUrl && config?.token),
  };
}
