import { useCallback, useEffect, useRef } from "react";
import { useActiveDiagramModel } from "@/features/diagram";
import { useLLMStore } from "../store";
import type { CommandRef, LLMConnection } from "../types";
import type { MentionRef } from "../mentions/mention-ref";
import type { SkillRef } from "../skills/skill.types";
import { useDiagramContext } from "./useDiagramContext";

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
  const messages = useLLMStore((state) => state.messages);
  const isLoading = useLLMStore((state) => state.isLoading);
  const pendingSuggestions = useLLMStore((state) => state.pendingSuggestions);
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
  const queuedMessages = useLLMStore((state) => state.queuedMessages);
  const removeQueuedMessage = useLLMStore((state) => state.removeQueuedMessage);
  const sendMessage = useLLMStore((state) => state.sendMessage);
  const cancelRequest = useLLMStore((state) => state.cancelRequest);
  const rerunAssistantMessage = useLLMStore((state) => state.rerunAssistantMessage);
  const setDiagramContextSource = useLLMStore((state) => state.setDiagramContextSource);
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

  /** The diagram and what the user is looking at, for the system prompt. */
  const buildContext = useCallback((): string => {
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
    return [diagramText, visualContext].filter(Boolean).join("");
  }, [diagramText, selIds, focusedNodeId, activeDiagram]);

  // A queued message is sent by the store when the running turn ends; it asks
  // for the context then, so the turn sees the diagram as it is at that time.
  const buildContextRef = useRef(buildContext);
  useEffect(() => {
    buildContextRef.current = buildContext;
  }, [buildContext]);
  useEffect(() => {
    setDiagramContextSource(() => buildContextRef.current());
    return () => setDiagramContextSource(null);
  }, [setDiagramContextSource]);

  const send = useCallback(
    async (
      userText: string,
      mentions: MentionRef[],
      command?: CommandRef,
      skills: SkillRef[] = [],
    ) => {
      return sendMessage(userText, buildContext(), {
        mentions,
        ...(command ? { command } : {}),
        ...(skills.length > 0 ? { skills } : {}),
      });
    },
    [buildContext, sendMessage],
  );

  /**
   * Asks again for the reply that `assistantMessageId` holds, replacing it.
   * The user message keeps its refs; they are resolved against the current
   * diagram when the request is built.
   */
  const rerun = useCallback(
    async (assistantMessageId: string) => {
      await rerunAssistantMessage(assistantMessageId, buildContext());
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
    streamingContent,
    queuedMessages,
    removeQueuedMessage,
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
