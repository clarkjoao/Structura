import { useCallback, useEffect } from "react";
import { useActiveDiagramModel } from "@/features/diagram";
import { buildMentionContextBlock, type ActiveMention } from "@/features/llm";
import { useLLMStore } from "@/features/llm/store";
import { useDiagramContext } from "./useDiagramContext";
import { useMentionSearch } from "./useMentionSearch";

interface UseLLMChatParams {
  selectedNodeIds: Set<string>;
  selectedNodeId: string | null;
}

const defaultLLMChatParams: UseLLMChatParams = {
  selectedNodeIds: new Set(),
  selectedNodeId: null,
};

export function useLLMChat(
  params: UseLLMChatParams = defaultLLMChatParams,
) {
  const activeDiagram = useActiveDiagramModel();
  const { diagramText, selectedNodeIds: selIds, focusedNodeId } =
    useDiagramContext(params);
  const { allItems } = useMentionSearch();
  const messages = useLLMStore((state) => state.messages);
  const isLoading = useLLMStore((state) => state.isLoading);
  const pendingSuggestions = useLLMStore((state) => state.pendingSuggestions);
  const pendingPreviews = useLLMStore((state) => state.pendingPreviews);
  const pendingAnalysis = useLLMStore((state) => state.pendingAnalysis);
  const streamingContent = useLLMStore((state) => state.streamingContent);
  const error = useLLMStore((state) => state.error);
  const config = useLLMStore((state) => state.config);
  const activeDiagramId = useLLMStore((state) => state.activeDiagramId);
  const loadHistoryForDiagram = useLLMStore((state) => state.loadHistoryForDiagram);
  const setLLMConfig = useLLMStore((state) => state.setLLMConfig);
  const sendMessage = useLLMStore((state) => state.sendMessage);
  const acceptSuggestion = useLLMStore((state) => state.acceptSuggestion);
  const rejectSuggestion = useLLMStore((state) => state.rejectSuggestion);
  const dismissPendingAnalysis = useLLMStore((state) => state.dismissPendingAnalysis);
  const clearHistory = useLLMStore((state) => state.clearHistory);

  useEffect(() => {
    if (activeDiagram?.id && activeDiagram.id !== activeDiagramId) {
      loadHistoryForDiagram(activeDiagram.id);
    }
  }, [activeDiagram?.id, activeDiagramId, loadHistoryForDiagram]);

  const send = useCallback(
    async (userText: string, mentions: ActiveMention[]) => {
      const mentionContext = buildMentionContextBlock(mentions, allItems);

      const visualContextLines: string[] = [];
      if (selIds.length > 0) {
        const components = activeDiagram?.snapshot?.components ?? {};
        const selectedLabels = selIds.map((id) => {
          const comp = components[id];
          return comp ? `${comp.name} (id=${id})` : id;
        });
        visualContextLines.push(
          `Selected nodes (${selIds.length}): ${selectedLabels.join(", ")}`,
        );
      }
      if (focusedNodeId && !selIds.includes(focusedNodeId)) {
        const comp = activeDiagram?.snapshot?.components?.[focusedNodeId];
        const label = comp
          ? `${comp.name} (id=${focusedNodeId})`
          : focusedNodeId;
        visualContextLines.push(
          `Focused node (ElementPanel open): ${label}`,
        );
      }

      const visualContext =
        visualContextLines.length > 0
          ? `\nCurrent user focus:\n${visualContextLines.join("\n")}`
          : "";

      const enrichedContext = [
        diagramText,
        visualContext,
        mentionContext ? `\n${mentionContext}` : "",
      ]
        .filter(Boolean)
        .join("");

      await sendMessage(userText, enrichedContext);
    },
    [
      allItems,
      diagramText,
      selIds,
      focusedNodeId,
      activeDiagram,
      sendMessage,
    ],
  );

  return {
    messages,
    send,
    isLoading,
    pendingSuggestions,
    pendingPreviews,
    pendingAnalysis,
    dismissPendingAnalysis,
    streamingContent,
    error,
    accept: acceptSuggestion,
    reject: rejectSuggestion,
    config,
    setConfig: setLLMConfig,
    clearHistory,
  };
}
