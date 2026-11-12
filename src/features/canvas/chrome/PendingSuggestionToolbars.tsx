import React, { useCallback, useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { getPendingNodeIds, getSuggestionIdForNode, type PendingNodePreview } from "@/features/llm";
import { useLLMChat } from "../chat";
import { PendingNodeToolbar } from "../selection-actions/PendingNodeToolbar";

interface PendingNodeToolbarsProps {
  pendingNodeIds: string[];
  pendingPreviews: PendingNodePreview[];
  onKeep: (suggestionId: string) => void;
  onDiscard: (suggestionId: string) => void;
}

const PendingNodeToolbars = React.memo(function PendingNodeToolbars({
  pendingNodeIds,
  pendingPreviews,
  onKeep,
  onDiscard,
}: PendingNodeToolbarsProps) {
  return (
    <>
      {pendingNodeIds.map((nodeId) => {
        const suggestionId = getSuggestionIdForNode(pendingPreviews, nodeId);
        if (!suggestionId) return null;
        return (
          <PendingNodeToolbar
            key={nodeId}
            nodeId={nodeId}
            suggestionId={suggestionId}
            onKeep={onKeep}
            onDiscard={onDiscard}
          />
        );
      })}
    </>
  );
});

/**
 * Keep / discard bars over the nodes an assistant suggestion would add. The
 * chat state is read here, inside the canvas, so a streamed reply re-renders
 * these bars and not the canvas around them.
 */
export function PendingSuggestionToolbars({
  selectedNodeIds,
  selectedNodeId,
}: {
  selectedNodeIds: Set<string>;
  selectedNodeId: string | null;
}) {
  const reactFlowInstance = useReactFlow();
  const {
    pendingPreviews,
    accept: acceptSuggestion,
    reject: rejectSuggestion,
  } = useLLMChat({ selectedNodeIds, selectedNodeId });
  const pendingNodeIds = useMemo(
    () => Array.from(getPendingNodeIds(pendingPreviews)),
    [pendingPreviews],
  );
  const accept = useCallback(
    (suggestionId: string) => {
      acceptSuggestion(suggestionId);
      setTimeout(() => {
        reactFlowInstance.setNodes((previousNodes) => previousNodes.map((node) => ({ ...node })));
      }, 50);
    },
    [acceptSuggestion, reactFlowInstance],
  );
  return (
    <PendingNodeToolbars
      pendingNodeIds={pendingNodeIds}
      pendingPreviews={pendingPreviews}
      onKeep={accept}
      onDiscard={rejectSuggestion}
    />
  );
}
