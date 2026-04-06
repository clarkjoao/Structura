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

export function LLMSettings({ config, onSave, onClose }: LLMSettingsProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<LLMMode>(config.mode);
  const [provider, setProvider] = useState<LLMProvider>(config.provider);
  const [apiKey, setApiKey] = useState(config.apiKey);
  const [model, setModel] = useState(config.model);
  const proxyEndpoint = useMemo(() => getProxyEndpoint(), []);

  const handleModeChange = (value: string) => {
    if (value === "direct" || value === "proxy") {
      setMode(value);
    }
  };

  const handleProviderChange = (value: string) => {
    if (value === "openai" || value === "anthropic") {
      setProvider(value);
    }
  };

  const handleSave = () => {
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
                onChange={(event) => setApiKey(event.target.value)}
              />
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
          <Input
            id="llm-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" size="sm" onClick={handleSave}>
            {t("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}

