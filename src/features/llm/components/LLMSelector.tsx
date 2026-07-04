import { Check, ChevronUp } from "lucide-react";
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

function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) {
    return label;
  }
  return `${label.slice(0, maxLength - 1)}…`;
}

export function LLMSelector({ config, onChange }: LLMSelectorProps) {
  const { t } = useTranslation();
  const currentLabel = useMemo(() => {
    if (config.mode === "proxy") {
      return t("llmChat.selector.proxy");
    }
    const preset = MODEL_PRESETS.find(
      (item) => item.provider === config.provider && item.model === config.model,
    );
    return truncateLabel(preset?.label ?? config.model, 14);
  }, [config.mode, config.model, config.provider, t]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t("llmChat.selector.label")}
          className="h-6 max-w-[140px] px-1.5 text-xs text-muted-foreground gap-1"
        >
          <span className="truncate max-w-[120px]">{currentLabel}</span>
          <ChevronUp className="h-3 w-3 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-1">
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
                <span className="truncate">{preset.label}</span>
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
