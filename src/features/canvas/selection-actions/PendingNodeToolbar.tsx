import { memo, useCallback, useMemo } from "react";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useDiagramStore } from "@/features/diagram";
import { useLLMStore, type PendingNodePreview } from "@/features/llm";
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

/**
 * The node a preview's toolbar sits on: its first node outside every other
 * node it adds (the region panel, not each subnet in it).
 */
function toolbarNodeId(
  preview: PendingNodePreview,
  parentOf: (nodeId: string) => string | null | undefined,
): string | undefined {
  const added = new Set(preview.nodeIds);
  return (
    preview.nodeIds.find((nodeId) => {
      const parentId = parentOf(nodeId);
      return !parentId || !added.has(parentId);
    }) ?? preview.nodeIds[0]
  );
}

/**
 * Keep/discard chrome for each LLM suggestion previewed on the canvas, once
 * per suggestion on its outermost node. Keep accepts the whole suggestion,
 * Discard rejects it.
 */
export const PendingNodeToolbars = memo(function PendingNodeToolbars() {
  const pendingPreviews = useLLMStore((state) => state.pendingPreviews);
  const components = useDiagramStore((state) =>
    state.activeDiagramId ? state.diagrams[state.activeDiagramId]?.snapshot.components : undefined,
  );
  const anchors = useMemo(
    () =>
      pendingPreviews.flatMap((preview) => {
        const nodeId = toolbarNodeId(preview, (id) => components?.[id]?.parentId);
        return nodeId ? [{ nodeId, suggestionId: preview.suggestionId }] : [];
      }),
    [pendingPreviews, components],
  );
  const accept = useCallback((suggestionId: string) => {
    void useLLMStore.getState().acceptSuggestion(suggestionId);
  }, []);
  const discard = useCallback((suggestionId: string) => {
    useLLMStore.getState().rejectSuggestion(suggestionId);
  }, []);
  return (
    <>
      {anchors.map(({ nodeId, suggestionId }) => (
        <PendingNodeToolbar
          key={suggestionId}
          nodeId={nodeId}
          suggestionId={suggestionId}
          onKeep={accept}
          onDiscard={discard}
        />
      ))}
    </>
  );
});
