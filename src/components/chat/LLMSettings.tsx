import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LLMConfig, LLMMode, LLMProvider } from "@/features/llm";
import { getProxyEndpoint } from "@/features/llm/providers/proxy";

interface LLMSettingsProps {
  config: LLMConfig;
  onSave: (config: LLMConfig) => void;
  onClose: () => void;
}

const PROVIDER_KEY_STORAGE = "structura:llm:keys";

function loadSavedKeyForProvider(provider: LLMProvider): string {
  try {
    const rawValue = localStorage.getItem(PROVIDER_KEY_STORAGE);
    if (!rawValue) {
      return "";
    }
    const parsedValue: unknown = JSON.parse(rawValue);
    if (typeof parsedValue !== "object" || parsedValue === null) {
      return "";
    }
    const maybeKey = Reflect.get(parsedValue, provider);
    return typeof maybeKey === "string" ? maybeKey : "";
  } catch {
    return "";
  }
}

function saveKeyForProvider(provider: LLMProvider, key: string): void {
  try {
    const rawValue = localStorage.getItem(PROVIDER_KEY_STORAGE);
    const parsedValue: unknown = rawValue ? JSON.parse(rawValue) : null;
    const parsedObject = typeof parsedValue === "object" && parsedValue !== null ? parsedValue : {};
    const nextKeys = {
      openai:
        typeof Reflect.get(parsedObject, "openai") === "string"
          ? String(Reflect.get(parsedObject, "openai"))
          : "",
      anthropic:
        typeof Reflect.get(parsedObject, "anthropic") === "string"
          ? String(Reflect.get(parsedObject, "anthropic"))
          : "",
      [provider]: key,
    };
    localStorage.setItem(PROVIDER_KEY_STORAGE, JSON.stringify(nextKeys));
  } catch {}
}

export function LLMSettings({ config, onSave, onClose }: LLMSettingsProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<LLMMode>(config.mode);
  const [provider, setProvider] = useState<LLMProvider>(config.provider);
  const [apiKey, setApiKey] = useState(
    () => config.apiKey || loadSavedKeyForProvider(config.provider),
  );
  const [apiKeyDirty, setApiKeyDirty] = useState(false);
  const [model, setModel] = useState(config.model);
  const proxyEndpoint = useMemo(() => getProxyEndpoint(), []);

  const handleModeChange = (value: string) => {
    if (value === "direct" || value === "proxy") {
      setMode(value);
    }
  };

  const handleProviderChange = (value: string) => {
    if (value === "openai" || value === "anthropic") {
      if (value !== provider) {
        if (apiKeyDirty) {
          saveKeyForProvider(provider, apiKey);
        }
        setApiKey(loadSavedKeyForProvider(value));
        setApiKeyDirty(false);
      }
      setProvider(value);
    }
  };

  const handleSave = () => {
    saveKeyForProvider(provider, apiKey);
    onSave({
      mode,
      provider,
      apiKey,
      model,
    });
    onClose();
  };

  return (
    <div className="absolute inset-0 z-30 bg-background/90 backdrop-blur-sm p-3">
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <h3 className="text-sm font-semibold">{t("llmChat.settings.title")}</h3>

        <div className="space-y-1">
          <label htmlFor="llm-mode" className="text-xs text-muted-foreground">
            {t("llmChat.settings.mode")}
          </label>
          <select
            id="llm-mode"
            className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            value={mode}
            onChange={(event) => handleModeChange(event.target.value)}
          >
            <option value="direct">{t("llmChat.settings.modeDirect")}</option>
            <option value="proxy">{t("llmChat.settings.modeProxy")}</option>
          </select>
        </div>

        {mode === "direct" ? (
          <>
            <div className="space-y-1">
              <label htmlFor="llm-provider" className="text-xs text-muted-foreground">
                {t("llmChat.settings.provider")}
              </label>
              <select
                id="llm-provider"
                className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                value={provider}
                onChange={(event) => handleProviderChange(event.target.value)}
              >
                <option value="openai">{t("llmChat.settings.providerOpenAI")}</option>
                <option value="anthropic">{t("llmChat.settings.providerAnthropic")}</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="llm-api-key" className="text-xs text-muted-foreground">
                {t("llmChat.settings.apiKey")}
              </label>
              <Input
                id="llm-api-key"
                type="password"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setApiKeyDirty(true);
                }}
              />
              {apiKey === "" ? (
                <p className="text-xs text-amber-600">
                  {t("llmChat.settings.apiKeyRequired", {
                    provider: provider === "openai" ? "OpenAI" : "Anthropic",
                  })}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <label htmlFor="llm-proxy-url" className="text-xs text-muted-foreground">
              {t("llmChat.settings.proxyUrl")}
            </label>
            <Input id="llm-proxy-url" value={proxyEndpoint} readOnly />
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor="llm-model" className="text-xs text-muted-foreground">
            {t("llmChat.settings.model")}
          </label>
          <Input id="llm-model" value={model} onChange={(event) => setModel(event.target.value)} />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={mode === "direct" && !apiKey.trim()}
          >
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
