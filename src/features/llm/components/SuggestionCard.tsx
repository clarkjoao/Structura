import { useMemo } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { DiagramPatchAction, PendingSuggestion } from "@/features/llm";

interface SuggestionCardProps {
  suggestion: PendingSuggestion;
  onAccept: (suggestionId: string) => void;
  onReject: (suggestionId: string) => void;
}

function assertUnreachable(value: never): string {
  return String(value);
}

function formatAction(action: DiagramPatchAction, translate: TFunction): string {
  switch (action.type) {
    case "ADD_NODE":
      return translate("llmChat.suggestion.action.addNode", {
        nodeType: action.payload.nodeType,
        nodeName: action.payload.name,
      });
    case "REMOVE_NODE":
      return translate("llmChat.suggestion.action.removeNode", { nodeId: action.payload.nodeId });
    case "UPDATE_NODE":
      return translate("llmChat.suggestion.action.updateNode", { nodeId: action.payload.nodeId });
    case "ADD_EDGE":
      return translate("llmChat.suggestion.action.addEdge", {
        sourceId: action.payload.sourceId,
        targetId: action.payload.targetId,
      });
    case "REMOVE_EDGE":
      return translate("llmChat.suggestion.action.removeEdge", { edgeId: action.payload.edgeId });
    case "INSERT_PATTERN":
      return translate("llmChat.suggestion.action.insertPattern", {
        patternId: action.payload.patternId,
      });
    case "AUTO_LAYOUT":
      return translate("llmChat.suggestion.action.autoLayout");
    case "GET_TAGS":
      return translate("llmChat.suggestion.action.getTags");
    default:
      return assertUnreachable(action);
  }
}

export function SuggestionCard({ suggestion, onAccept, onReject }: SuggestionCardProps) {
  const { t } = useTranslation();
  const actionLines = useMemo(
    () => suggestion.patch.actions.map((action) => formatAction(action, t)),
    [suggestion.patch.actions, t],
  );
  const isPending = suggestion.status === "pending";

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <p className="text-xs font-medium text-foreground">{suggestion.patch.description}</p>
      <div className="space-y-1">
        {actionLines.map((line) => (
          <p key={line} className="text-xs text-muted-foreground">
            {line}
          </p>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => onAccept(suggestion.id)}
          disabled={!isPending}
        >
          {t("llmChat.suggestion.accept")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onReject(suggestion.id)}
          disabled={!isPending}
        >
          {t("llmChat.suggestion.reject")}
        </Button>
      </div>
    </div>
  );
}
