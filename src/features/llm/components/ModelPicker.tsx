import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLLMStore } from "@/features/llm";
import { modelsForConnection } from "@/features/llm/model-presets";

/** Compact model switcher for the active connection, next to the connection switcher. */
export function ModelPicker() {
  const { t } = useTranslation();
  const connections = useLLMStore((state) => state.connections);
  const activeConnectionId = useLLMStore((state) => state.activeConnectionId);
  const updateConnection = useLLMStore((state) => state.updateConnection);

  const active = useMemo(
    () => connections.find((connection) => connection.id === activeConnectionId),
    [connections, activeConnectionId],
  );
  if (!active) return null;
  const models = modelsForConnection(active);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t("llmChat.modelPicker.label")}
          title={t("llmChat.modelPicker.label")}
          className="h-6 max-w-[150px] gap-1 px-1.5 font-mono text-[11px] text-muted-foreground"
        >
          <span className="truncate">{active.model}</span>
          <ChevronUp className="h-3 w-3 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="max-h-72 w-64 overflow-y-auto p-1">
        {models.map((model) => (
          <button
            key={model}
            type="button"
            onClick={() => updateConnection(active.id, { model })}
            className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left font-mono text-xs hover:bg-accent hover:text-accent-foreground"
          >
            <span className="truncate">{model}</span>
            {model === active.model ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
