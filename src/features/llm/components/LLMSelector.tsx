import { Check, ChevronUp } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLLMStore } from "@/features/llm";
import { cn } from "@/lib/utils";

interface LLMSelectorProps {
  onOpenSettings: () => void;
}

function truncateLabel(label: string, maxLength: number): string {
  if (label.length <= maxLength) {
    return label;
  }
  return `${label.slice(0, maxLength - 1)}…`;
}

export function LLMSelector({ onOpenSettings }: LLMSelectorProps) {
  const { t } = useTranslation();
  const connections = useLLMStore((state) => state.connections);
  const activeConnectionId = useLLMStore((state) => state.activeConnectionId);
  const setActiveConnection = useLLMStore((state) => state.setActiveConnection);

  const activeConnection = useMemo(
    () => connections.find((connection) => connection.id === activeConnectionId),
    [connections, activeConnectionId],
  );

  const currentLabel = useMemo(() => {
    if (!activeConnection) {
      return "";
    }
    if (activeConnection.mode === "proxy") {
      return t("llmChat.selector.proxy");
    }
    return truncateLabel(activeConnection.name, 18);
  }, [activeConnection, t]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t("llmChat.selector.label")}
          className="h-6 max-w-[160px] px-1.5 text-xs text-muted-foreground gap-1"
        >
          <span className="truncate max-w-[140px]">{currentLabel}</span>
          <ChevronUp className="h-3 w-3 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-72 p-1">
        <div className="space-y-1">
          {connections.map((connection) => {
            const isSelected = connection.id === activeConnectionId;
            return (
              <button
                key={connection.id}
                type="button"
                onClick={() => setActiveConnection(connection.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-xs",
                  "hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <div className="flex min-w-0 flex-col items-start">
                  <span className="truncate font-medium">{connection.name}</span>
                  <span className="truncate text-[10px] text-muted-foreground">
                    {connection.provider} · {connection.model}
                  </span>
                </div>
                {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
              </button>
            );
          })}
          <div className="my-1 border-t border-border" />
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex w-full items-center rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
          >
            <span>{t("llmChat.selector.manageConnections")}</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
