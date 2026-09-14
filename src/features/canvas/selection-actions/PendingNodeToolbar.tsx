import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DiagramNodeToolbar, DiagramPosition } from "../core/DiagramFlowProvider";

interface PendingNodeToolbarProps {
  nodeId: string;
  suggestionId: string;
  onKeep: (suggestionId: string) => void;
  onDiscard: (suggestionId: string) => void;
}

/**
 * Keep/discard chrome for an LLM-suggested node. Canvas-owned because it
 * mounts inside React Flow via NodeToolbar (ADR-0001).
 */
export function PendingNodeToolbar({
  nodeId,
  suggestionId,
  onKeep,
  onDiscard,
}: PendingNodeToolbarProps) {
  const { t } = useTranslation();

  return (
    <DiagramNodeToolbar nodeId={nodeId} isVisible position={DiagramPosition.Top} offset={10}>
      <div className="flex items-center gap-2 rounded-md border border-border bg-card/95 p-1 shadow-md backdrop-blur-sm">
        <Button
          type="button"
          size="sm"
          className="h-7 bg-green-500 px-2.5 text-white hover:bg-green-600"
          onClick={() => onKeep(suggestionId)}
        >
          <Check className="h-3.5 w-3.5" />
          {t("llmChat.preview.keep")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2.5"
          onClick={() => onDiscard(suggestionId)}
        >
          <X className="h-3.5 w-3.5" />
          {t("llmChat.preview.discard")}
        </Button>
      </div>
    </DiagramNodeToolbar>
  );
}
