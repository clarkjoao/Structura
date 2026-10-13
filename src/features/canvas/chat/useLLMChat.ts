import { useCallback, useEffect } from "react";
import { useActiveDiagramModel } from "@/features/diagram";
import {
  buildMentionContextBlock,
  useLLMStore,
  type ActiveMention,
  type LLMConnection,
} from "@/features/llm";
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

export function useLLMChat(params: UseLLMChatParams = defaultLLMChatParams) {
  const activeDiagram = useActiveDiagramModel();
  const { diagramText, selectedNodeIds: selIds, focusedNodeId } = useDiagramContext(params);
  const { allItems } = useMentionSearch();
  const messages = useLLMStore((state) => state.messages);
  const isLoading = useLLMStore((state) => state.isLoading);
  const pendingSuggestions = useLLMStore((state) => state.pendingSuggestions);
  const pendingPreviews = useLLMStore((state) => state.pendingPreviews);
  const streamingContent = useLLMStore((state) => state.streamingContent);
  const config = useLLMStore((state) => state.config);
  const activeDiagramId = useLLMStore((state) => state.activeDiagramId);
  const activeThreadId = useLLMStore((state) => state.activeThreadId);
  const threadsByDiagram = useLLMStore((state) => state.threadsByDiagram);
  const connections = useLLMStore((state) => state.connections);
  const activeConnectionId = useLLMStore((state) => state.activeConnectionId);
  const loadHistoryForDiagram = useLLMStore((state) => state.loadHistoryForDiagram);
  const setLLMConfig = useLLMStore((state) => state.setLLMConfig);
  const setActiveConnection = useLLMStore((state) => state.setActiveConnection);
  const sendMessage = useLLMStore((state) => state.sendMessage);
  const cancelRequest = useLLMStore((state) => state.cancelRequest);
  const rerunAssistantMessage = useLLMStore((state) => state.rerunAssistantMessage);
  const acceptSuggestion = useLLMStore((state) => state.acceptSuggestion);
  const rejectSuggestion = useLLMStore((state) => state.rejectSuggestion);
  const clearHistory = useLLMStore((state) => state.clearHistory);
  const createThread = useLLMStore((state) => state.createThread);
  const switchThread = useLLMStore((state) => state.switchThread);
  const renameThread = useLLMStore((state) => state.renameThread);
  const deleteThread = useLLMStore((state) => state.deleteThread);

  useEffect(() => {
    if (activeDiagram?.id && activeDiagram.id !== activeDiagramId) {
      loadHistoryForDiagram(activeDiagram.id);
    }
  }, [activeDiagram?.id, activeDiagramId, loadHistoryForDiagram]);

  /** The diagram, what the user is looking at, and any @-mentioned elements. */
  const buildContext = useCallback(
    (mentions: ActiveMention[]): string => {
      const mentionContext = buildMentionContextBlock(mentions, allItems);

      const visualContextLines: string[] = [];
      if (selIds.length > 0) {
        const components = activeDiagram?.snapshot?.components ?? {};
        const selectedLabels = selIds.map((id) => {
          const comp = components[id];
          return comp ? `${comp.name} (id=${id})` : id;
        });
        visualContextLines.push(`Selected nodes (${selIds.length}): ${selectedLabels.join(", ")}`);
      }
      if (focusedNodeId && !selIds.includes(focusedNodeId)) {
        const comp = activeDiagram?.snapshot?.components?.[focusedNodeId];
        const label = comp ? `${comp.name} (id=${focusedNodeId})` : focusedNodeId;
        visualContextLines.push(`Focused node (ElementPanel open): ${label}`);
      }

      const visualContext =
        visualContextLines.length > 0
          ? `\nCurrent user focus:\n${visualContextLines.join("\n")}`
          : "";

      return [diagramText, visualContext, mentionContext ? `\n${mentionContext}` : ""]
        .filter(Boolean)
        .join("");
    },
    [allItems, diagramText, selIds, focusedNodeId, activeDiagram],
  );

  const send = useCallback(
    async (userText: string, mentions: ActiveMention[]) => {
      await sendMessage(userText, buildContext(mentions));
    },
    [buildContext, sendMessage],
  );

  /**
   * Asks again for the reply that `assistantMessageId` holds, replacing it.
   * Mentions are not stored with a message, so the context is the current
   * diagram and selection.
   */
  const rerun = useCallback(
    async (assistantMessageId: string) => {
      await rerunAssistantMessage(assistantMessageId, buildContext([]));
    },
    [buildContext, rerunAssistantMessage],
  );

  const threads = activeDiagramId ? (threadsByDiagram[activeDiagramId]?.threads ?? []) : [];
  const activeThread = threads.find((thread) => thread.id === activeThreadId) ?? null;
  const activeConnection: LLMConnection | undefined = connections.find(
    (connection) => connection.id === activeConnectionId,
  );

  return {
    messages,
    send,
    cancel: cancelRequest,
    rerun,
    isLoading,
    pendingSuggestions,
    pendingPreviews,
    streamingContent,
    accept: acceptSuggestion,
    reject: rejectSuggestion,
    config,
    connections,
    activeConnection,
    activeConnectionId,
    setActiveConnection,
    setConfig: setLLMConfig,
    clearHistory,
    threads,
    activeThread,
    createThread,
    switchThread,
    renameThread,
    deleteThread,
    loadHistoryForDiagram,
    activeDiagramId,
  };
}
