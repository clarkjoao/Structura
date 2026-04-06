import { MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DEFAULT_SUGGESTIONS } from "@/features/llm";

interface ChatSuggestionsEmptyStateProps {
  diagramName: string;
  onSelectSuggestion: (text: string) => void;
}

export function ChatSuggestionsEmptyState({
  diagramName,
  onSelectSuggestion,
}: ChatSuggestionsEmptyStateProps) {
  const { t } = useTranslation();
  const resolvedName = diagramName.trim() || t("common.none");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <MessageSquare className="h-8 w-8 text-primary" aria-hidden />
        <h4 className="text-sm font-semibold">{t("llmChat.title")}</h4>
        <p className="text-xs text-muted-foreground">
          {t("llmChat.suggestions.context", { name: resolvedName })}
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {t("llmChat.suggestions.title")}
        </p>
        <div className="space-y-2">
          {DEFAULT_SUGGESTIONS.map((suggestion) => (
            <Button
              key={suggestion.id}
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start text-left text-sm text-foreground"
              onClick={() => onSelectSuggestion(t(suggestion.labelKey))}
            >
              <span className="block w-full truncate">{t(suggestion.labelKey)}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
