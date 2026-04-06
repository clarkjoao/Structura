import { Check, ChevronDown } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MODEL_PRESETS, type LLMConfig } from "@/features/llm";
import { cn } from "@/lib/utils";

interface LLMSelectorProps {
  config: LLMConfig;
  onChange: (config: LLMConfig) => void;
}

function getProviderBadgeClass(provider: "openai" | "anthropic"): string {
  return provider === "anthropic"
    ? "text-orange-600 bg-orange-500/15"
    : "text-muted-foreground bg-muted";
}

export function LLMSelector({ config, onChange }: LLMSelectorProps) {
  const { t } = useTranslation();
  const getProviderLabel = (provider: "openai" | "anthropic") =>
    provider === "anthropic"
      ? t("llmChat.selector.providerAnthropic")
      : t("llmChat.selector.providerOpenai");
  const currentLabel = useMemo(() => {
    if (config.mode === "proxy") {
      return t("llmChat.selector.proxy");
    }
    const preset = MODEL_PRESETS.find(
      (item) => item.provider === config.provider && item.model === config.model,
    );
    return preset?.label ?? config.model;
  }, [config.mode, config.model, config.provider, t]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t("llmChat.selector.label")}
          className="h-7 max-w-[165px] px-2 text-xs"
        >
          <span className="truncate">{currentLabel}</span>
          <ChevronDown className="ml-1 h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1">
        <div className="space-y-1">
          {MODEL_PRESETS.map((preset) => {
            const isSelected =
              config.mode === "direct" &&
              preset.provider === config.provider &&
              preset.model === config.model;
            const isDisabled = config.mode === "proxy";
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onChange({
                    mode: "direct",
                    provider: preset.provider,
                    model: preset.model,
                    apiKey: config.apiKey,
                  })
                }
                disabled={isDisabled}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs",
                  isDisabled
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "rounded px-1 py-0.5 text-[10px] font-medium",
                      getProviderBadgeClass(preset.provider),
                    )}
                  >
                    {getProviderLabel(preset.provider)}
                  </span>
                  <span className="truncate">{preset.label}</span>
                </span>
                {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>
            );
          })}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={() => onChange({ ...config, mode: "proxy" })}
            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
          >
            <span>{t("llmChat.selector.proxy")}</span>
            {config.mode === "proxy" ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

