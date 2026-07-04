import { Check, X } from "lucide-react";
import { NodeToolbar, Position } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface PendingNodeToolbarProps {
  nodeId: string;
  suggestionId: string;
  onKeep: (suggestionId: string) => void;
  onDiscard: (suggestionId: string) => void;
}

export function PendingNodeToolbar({
  nodeId,
  suggestionId,
  onKeep,
  onDiscard,
}: PendingNodeToolbarProps) {
  const { t } = useTranslation();

  return (
    <NodeToolbar nodeId={nodeId} isVisible position={Position.Top} offset={10}>
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
    </NodeToolbar>
  );
}
