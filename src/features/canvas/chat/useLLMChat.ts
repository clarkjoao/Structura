import { useCallback, useEffect } from "react";
import { useActiveDiagram } from "@/features/diagram";
import { buildMentionContextBlock, type ActiveMention } from "@/features/llm";
import { useLLMStore } from "@/features/llm/store";
import { useDiagramContext } from "./useDiagramContext";
import { useMentionSearch } from "./useMentionSearch";

export function useLLMChat() {
  const activeDiagram = useActiveDiagram();
  const diagramContext = useDiagramContext();
  const { allItems } = useMentionSearch();
  const messages = useLLMStore((state) => state.messages);
  const isLoading = useLLMStore((state) => state.isLoading);
  const pendingSuggestions = useLLMStore((state) => state.pendingSuggestions);
  const pendingPreviews = useLLMStore((state) => state.pendingPreviews);
  const streamingContent = useLLMStore((state) => state.streamingContent);
  const error = useLLMStore((state) => state.error);
  const config = useLLMStore((state) => state.config);
  const activeDiagramId = useLLMStore((state) => state.activeDiagramId);
  const loadHistoryForDiagram = useLLMStore((state) => state.loadHistoryForDiagram);
  const setLLMConfig = useLLMStore((state) => state.setLLMConfig);
  const sendMessage = useLLMStore((state) => state.sendMessage);
  const acceptSuggestion = useLLMStore((state) => state.acceptSuggestion);
  const rejectSuggestion = useLLMStore((state) => state.rejectSuggestion);
  const clearHistory = useLLMStore((state) => state.clearHistory);

  useEffect(() => {
    if (activeDiagram?.id && activeDiagram.id !== activeDiagramId) {
      loadHistoryForDiagram(activeDiagram.id);
    }
  }, [activeDiagram?.id, activeDiagramId, loadHistoryForDiagram]);

  const send = useCallback(
    async (userText: string, mentions: ActiveMention[]) => {
      const mentionContext = buildMentionContextBlock(mentions, allItems);
      const enrichedContext = mentionContext
        ? `${diagramContext}\n\n${mentionContext}`
        : diagramContext;
      await sendMessage(userText, enrichedContext);
    },
    [allItems, diagramContext, sendMessage],
  );

  return {
    messages,
    send,
    isLoading,
    pendingSuggestions,
    pendingPreviews,
    streamingContent,
    error,
    accept: acceptSuggestion,
    reject: rejectSuggestion,
    config,
    setConfig: setLLMConfig,
    clearHistory,
  };
}

