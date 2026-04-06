import { useCallback } from "react";
import { buildMentionContextBlock, type ActiveMention } from "@/features/llm";
import { useLLMStore } from "@/features/llm/store";
import { useDiagramContext } from "./useDiagramContext";
import { useMentionSearch } from "./useMentionSearch";

export function useLLMChat() {
  const diagramContext = useDiagramContext();
  const { allItems } = useMentionSearch();
  const messages = useLLMStore((state) => state.messages);
  const isLoading = useLLMStore((state) => state.isLoading);
  const pendingSuggestions = useLLMStore((state) => state.pendingSuggestions);
  const pendingPreviews = useLLMStore((state) => state.pendingPreviews);
  const config = useLLMStore((state) => state.config);
  const setLLMConfig = useLLMStore((state) => state.setLLMConfig);
  const sendMessage = useLLMStore((state) => state.sendMessage);
  const acceptSuggestion = useLLMStore((state) => state.acceptSuggestion);
  const rejectSuggestion = useLLMStore((state) => state.rejectSuggestion);

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
    accept: acceptSuggestion,
    reject: rejectSuggestion,
    config,
    setConfig: setLLMConfig,
  };
}

