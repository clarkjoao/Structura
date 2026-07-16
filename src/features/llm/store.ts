import { create } from "zustand";
import { useDiagramStore } from "@/features/diagram";
import i18n from "@/infrastructure/i18n";
import { buildSystemPrompt } from "./prompt-builder";
import { parseLLMResponse } from "./patch-parser";
import { LLMProviderError, type LLMErrorKind } from "./errors";
import { deriveThreadTitle } from "./llm-storage";
import type {
  AnalysisResponse,
  ChatMessage,
  ConversationThread,
  DiagramThreadState,
  DiagramPatch,
  LLMConfig,
  LLMConnection,
  PendingNodePreview,
  PendingSuggestion,
} from "./types";
import {
  loadConnections,
  loadThreadsForDiagram,
  saveConnections,
  saveThreadsForDiagram,
} from "./llm-storage";
import { applyDiagramPatchAction, computeGridPositions, resolveRef } from "./apply-diagram-patch";
import { sendMessage as sendOpenAIMessage } from "./providers/openai";
import { sendMessage as sendAnthropicMessage } from "./providers/anthropic";
import { sendMessage as sendProxyMessage } from "./providers/proxy";
import { sendMessage as sendCustomMessage } from "./providers/custom";

function getResolvedAppLanguage(): string {
  const lng = i18n.resolvedLanguage ?? i18n.language ?? "pt-BR";
  const lower = lng.toLowerCase();
  if (lower.startsWith("pt")) {
    return "pt-BR";
  }
  if (lower.startsWith("en")) {
    return "en";
  }
  return "pt-BR";
}

function sanitizeMessagesForLLM(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => {
    if (message.role !== "assistant") {
      return message;
    }
    const trimmed = message.content.trim();
    if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
      return message;
    }
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed.mode === "analysis" && typeof parsed.summary === "string") {
        return { ...message, content: parsed.summary };
      }
      if (typeof parsed.message === "string") {
        return { ...message, content: parsed.message };
      }
    } catch {}
    return { ...message, content: "[previous diagram suggestion]" };
  });
}

function ensureHistoryBoundary(): void {
  useDiagramStore.getState().pushHistoryBoundary();
}

function connectionToConfig(connection: LLMConnection): LLMConfig {
  return {
    mode: connection.mode,
    provider: connection.provider,
    apiKey: connection.apiKey,
    model: connection.model,
    ...(connection.baseUrl ? { baseUrl: connection.baseUrl } : {}),
    ...(connection.authHeader ? { authHeader: connection.authHeader } : {}),
    ...(connection.extraHeaders ? { extraHeaders: connection.extraHeaders } : {}),
    ...(connection.extraParams ? { extraParams: connection.extraParams } : {}),
  };
}

function defaultTitleForLanguage(): string {
  return getResolvedAppLanguage() === "en" ? "New conversation" : "Nova conversa";
}

async function executeLLMMessage(
  config: LLMConfig,
  messages: ChatMessage[],
  systemPrompt: string,
  onChunk: (chunk: string) => void,
): Promise<string> {
  if (config.mode === "proxy") {
    return sendProxyMessage(config, messages, systemPrompt, onChunk);
  }
  if (config.provider === "anthropic") {
    return sendAnthropicMessage(config, messages, systemPrompt, onChunk);
  }
  if (config.provider === "custom") {
    return sendCustomMessage(config, messages, systemPrompt, onChunk);
  }
  return sendOpenAIMessage(config, messages, systemPrompt, onChunk);
}

export interface LLMStoreState {
  connections: LLMConnection[];
  activeConnectionId: string;
  config: LLMConfig;
  threadsByDiagram: Record<string, DiagramThreadState>;
  activeDiagramId: string | null;
  activeThreadId: string;
  messages: ChatMessage[];
  pendingSuggestions: PendingSuggestion[];
  pendingPreviews: PendingNodePreview[];
  pendingAnalysis: AnalysisResponse | null;
  streamingContent: string | null;
  isLoading: boolean;
  error: LLMErrorKind | null;

  setLLMConfig: (config: LLMConfig) => void;
  setActiveConnection: (id: string) => void;
  createConnection: (draft: Omit<LLMConnection, "id"> & { id?: string }) => LLMConnection;
  updateConnection: (id: string, patch: Partial<LLMConnection>) => void;
  duplicateConnection: (id: string) => LLMConnection | null;
  removeConnection: (id: string) => boolean;

  loadHistoryForDiagram: (diagramId: string) => void;
  switchThread: (threadId: string) => void;
  createThread: (diagramId: string, firstUserMessage?: string) => ConversationThread;
  renameThread: (threadId: string, title: string) => void;
  deleteThread: (threadId: string) => void;

  sendMessage: (userText: string, diagramContext: string) => Promise<void>;
  acceptSuggestion: (suggestionId: string) => void;
  rejectSuggestion: (suggestionId: string) => void;
  dismissPendingAnalysis: () => void;
  /**
   * @deprecated Replaced by `createThread`. Kept for the panel until Fase 6.
   */
  clearHistory: () => void;
}

function persistActiveThread(state: LLMStoreState): void {
  const { activeDiagramId, activeThreadId, messages, threadsByDiagram } = state;
  if (!activeDiagramId || !activeThreadId) {
    return;
  }
  const entry = threadsByDiagram[activeDiagramId];
  if (!entry) {
    return;
  }
  const updatedThreads = entry.threads.map((thread) =>
    thread.id === activeThreadId
      ? {
          ...thread,
          messages,
          title: deriveThreadTitle(messages) || thread.title,
          updatedAt: Date.now(),
        }
      : thread,
  );
  const nextEntry: DiagramThreadState = {
    threads: updatedThreads,
    activeThreadId: entry.activeThreadId,
  };
  saveThreadsForDiagram(activeDiagramId, nextEntry);
  state.threadsByDiagram = { ...state.threadsByDiagram, [activeDiagramId]: nextEntry };
}

function freshThreadState(): DiagramThreadState {
  return { threads: [], activeThreadId: "" };
}

export const useLLMStore = create<LLMStoreState>((set, get) => {
  const initialConnections = loadConnections();
  const initialConnection =
    initialConnections.connections.find(
      (connection) => connection.id === initialConnections.activeConnectionId,
    ) ?? initialConnections.connections[0];

  if (!initialConnection) {
    throw new Error("loadConnections returned no connections");
  }

  const persistThread = () => persistActiveThread(get());
  const setWithPersist = (partial: Partial<LLMStoreState>) => set(partial);

  return {
    connections: initialConnections.connections,
    activeConnectionId: initialConnection.id,
    config: connectionToConfig(initialConnection),
    threadsByDiagram: {},
    activeDiagramId: null,
    activeThreadId: "",
    messages: [],
    pendingSuggestions: [],
    pendingPreviews: [],
    pendingAnalysis: null,
    streamingContent: null,
    isLoading: false,
    error: null,

    setLLMConfig: (config) => {
      const { activeConnectionId, connections } = get();
      const updated: LLMConnection[] = connections.map((connection) =>
        connection.id === activeConnectionId
          ? {
              ...connection,
              mode: config.mode,
              provider: config.provider,
              apiKey: config.apiKey,
              model: config.model,
              ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}),
              ...(config.authHeader !== undefined ? { authHeader: config.authHeader } : {}),
              ...(config.extraHeaders !== undefined ? { extraHeaders: config.extraHeaders } : {}),
              ...(config.extraParams !== undefined ? { extraParams: config.extraParams } : {}),
            }
          : connection,
      );
      saveConnections({ connections: updated, activeConnectionId });
      set({ connections: updated, config });
    },

    setActiveConnection: (id) => {
      const next = get().connections.find((connection) => connection.id === id);
      if (!next) {
        return;
      }
      saveConnections({ connections: get().connections, activeConnectionId: id });
      set({ activeConnectionId: id, config: connectionToConfig(next) });
    },

    createConnection: (draft) => {
      const id = draft.id ?? crypto.randomUUID();
      const connection: LLMConnection = { ...draft, id };
      const updated = [...get().connections, connection];
      saveConnections({ connections: updated, activeConnectionId: id });
      set({
        connections: updated,
        activeConnectionId: id,
        config: connectionToConfig(connection),
      });
      return connection;
    },

    updateConnection: (id, patch) => {
      const updated: LLMConnection[] = get().connections.map((connection) =>
        connection.id === id ? { ...connection, ...patch, id } : connection,
      );
      saveConnections({ connections: updated, activeConnectionId: get().activeConnectionId });
      const isActive = get().activeConnectionId === id;
      set({
        connections: updated,
        ...(isActive
          ? {
              config: connectionToConfig(
                updated.find((candidate) => candidate.id === id) as LLMConnection,
              ),
            }
          : {}),
      });
    },

    duplicateConnection: (id) => {
      const source = get().connections.find((connection) => connection.id === id);
      if (!source) {
        return null;
      }
      const isPt = getResolvedAppLanguage().startsWith("pt");
      const duplicate: LLMConnection = {
        ...source,
        id: crypto.randomUUID(),
        name: `${source.name}${isPt ? " (cópia)" : " (copy)"}`,
      };
      const updated = [...get().connections, duplicate];
      saveConnections({ connections: updated, activeConnectionId: get().activeConnectionId });
      set({ connections: updated });
      return duplicate;
    },

    removeConnection: (id) => {
      const { connections, activeConnectionId } = get();
      if (id === activeConnectionId) {
        return false;
      }
      const updated = connections.filter((connection) => connection.id !== id);
      if (updated.length === 0) {
        const fallback: LLMConnection = {
          id: crypto.randomUUID(),
          name: "Default",
          mode: "proxy",
          provider: "openai",
          apiKey: "",
          model: "gpt-4o-mini",
        };
        updated.push(fallback);
        saveConnections({ connections: updated, activeConnectionId: fallback.id });
        set({
          connections: updated,
          activeConnectionId: fallback.id,
          config: connectionToConfig(fallback),
        });
        return true;
      }
      saveConnections({ connections: updated, activeConnectionId });
      set({ connections: updated });
      return true;
    },

    loadHistoryForDiagram: (diagramId) => {
      const state = loadThreadsForDiagram(diagramId);
      const threads = state.threads;
      const activeThreadId =
        threads.find((thread) => thread.id === state.activeThreadId)?.id ?? threads[0]?.id ?? "";
      const activeThread = threads.find((thread) => thread.id === activeThreadId);
      setWithPersist({
        threadsByDiagram: {
          ...get().threadsByDiagram,
          [diagramId]: { threads, activeThreadId },
        },
        activeDiagramId: diagramId,
        activeThreadId,
        messages: activeThread?.messages ?? [],
        pendingSuggestions: [],
        pendingPreviews: [],
        pendingAnalysis: null,
        streamingContent: null,
        error: null,
      });
    },

    switchThread: (threadId) => {
      const { activeDiagramId, threadsByDiagram } = get();
      if (!activeDiagramId) {
        return;
      }
      const entry = threadsByDiagram[activeDiagramId] ?? freshThreadState();
      const thread = entry.threads.find((candidate) => candidate.id === threadId);
      if (!thread) {
        return;
      }
      const nextEntry: DiagramThreadState = { threads: entry.threads, activeThreadId: threadId };
      setWithPersist({
        threadsByDiagram: { ...threadsByDiagram, [activeDiagramId]: nextEntry },
        activeThreadId: threadId,
        messages: thread.messages,
        pendingSuggestions: [],
        pendingPreviews: [],
        pendingAnalysis: null,
        streamingContent: null,
        error: null,
      });
    },

    createThread: (diagramId, firstUserMessage) => {
      const draft: ConversationThread = {
        id: crypto.randomUUID(),
        diagramId,
        title:
          deriveThreadTitle([
            {
              id: "seed",
              role: "user",
              content: firstUserMessage ?? "",
              timestamp: Date.now(),
            },
          ]) || defaultTitleForLanguage(),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const previous = get().threadsByDiagram[diagramId] ?? freshThreadState();
      const entry: DiagramThreadState = {
        threads: [...previous.threads, draft],
        activeThreadId: draft.id,
      };
      saveThreadsForDiagram(diagramId, entry);
      setWithPersist({
        threadsByDiagram: { ...get().threadsByDiagram, [diagramId]: entry },
        activeDiagramId: diagramId,
        activeThreadId: draft.id,
        messages: [],
        pendingSuggestions: [],
        pendingPreviews: [],
        pendingAnalysis: null,
        streamingContent: null,
        error: null,
      });
      return draft;
    },

    renameThread: (threadId, title) => {
      const { activeDiagramId, threadsByDiagram } = get();
      if (!activeDiagramId) {
        return;
      }
      const entry = threadsByDiagram[activeDiagramId];
      if (!entry) {
        return;
      }
      const updatedThreads = entry.threads.map((thread) =>
        thread.id === threadId ? { ...thread, title } : thread,
      );
      const nextEntry: DiagramThreadState = {
        threads: updatedThreads,
        activeThreadId: entry.activeThreadId,
      };
      saveThreadsForDiagram(activeDiagramId, nextEntry);
      setWithPersist({
        threadsByDiagram: { ...threadsByDiagram, [activeDiagramId]: nextEntry },
      });
    },

    deleteThread: (threadId) => {
      const { activeDiagramId, threadsByDiagram } = get();
      if (!activeDiagramId) {
        return;
      }
      const entry = threadsByDiagram[activeDiagramId];
      if (!entry) {
        return;
      }
      const remaining = entry.threads.filter((thread) => thread.id !== threadId);
      if (remaining.length === 0) {
        // Last thread in this diagram: don't call createThread (it would
        // re-read `entry.threads` and reintroduce the thread we just filtered
        // out). Inline the replacement to keep storage and memory consistent.
        const fallback: ConversationThread = {
          id: crypto.randomUUID(),
          diagramId: activeDiagramId,
          title: defaultTitleForLanguage(),
          messages: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const nextEntry: DiagramThreadState = {
          threads: [fallback],
          activeThreadId: fallback.id,
        };
        saveThreadsForDiagram(activeDiagramId, nextEntry);
        setWithPersist({
          threadsByDiagram: { ...threadsByDiagram, [activeDiagramId]: nextEntry },
          activeDiagramId,
          activeThreadId: fallback.id,
          messages: [],
          pendingSuggestions: [],
          pendingPreviews: [],
          pendingAnalysis: null,
          streamingContent: null,
          error: null,
        });
        return;
      }
      const wasActive = entry.activeThreadId === threadId;
      const nextActiveId = wasActive ? remaining[remaining.length - 1]!.id : entry.activeThreadId;
      const nextEntry: DiagramThreadState = { threads: remaining, activeThreadId: nextActiveId };
      saveThreadsForDiagram(activeDiagramId, nextEntry);
      setWithPersist({
        threadsByDiagram: { ...threadsByDiagram, [activeDiagramId]: nextEntry },
        activeThreadId: nextActiveId,
        ...(wasActive
          ? {
              messages: remaining.find((thread) => thread.id === nextActiveId)?.messages ?? [],
              pendingSuggestions: [],
              pendingPreviews: [],
              pendingAnalysis: null,
              streamingContent: null,
              error: null,
            }
          : {}),
      });
    },

    sendMessage: async (userText, diagramContext) => {
      if (!userText.trim()) {
        return;
      }
      const state = get();

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: userText.trim(),
        timestamp: Date.now(),
      };
      const outgoingMessages = [...state.messages, userMessage];
      const assistantMessageId = crypto.randomUUID();
      const placeholderMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };
      set({
        messages: [...outgoingMessages, placeholderMessage],
        streamingContent: "",
        isLoading: true,
        error: null,
      });

      try {
        const systemPrompt = buildSystemPrompt(diagramContext, getResolvedAppLanguage());
        const sanitizedMessages = sanitizeMessagesForLLM(outgoingMessages);
        let fullResponse = "";
        const rawAssistantResponse = await executeLLMMessage(
          state.config,
          sanitizedMessages,
          systemPrompt,
          (chunk) => {
            fullResponse += chunk;
            const trimmedAccumulated = fullResponse.trim();
            const looksLikeJsonEnvelope = trimmedAccumulated.startsWith("{");
            set((streamingState) => ({
              streamingContent: fullResponse,
              messages: streamingState.messages.map((message) =>
                message.id === assistantMessageId
                  ? {
                      ...message,
                      content: looksLikeJsonEnvelope ? "" : fullResponse,
                    }
                  : message,
              ),
            }));
          },
        );
        const parsedResponse = parseLLMResponse(rawAssistantResponse);

        if (parsedResponse.kind === "analysis") {
          set({
            messages: get().messages.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: parsedResponse.analysis.summary }
                : message,
            ),
            pendingAnalysis: parsedResponse.analysis,
            streamingContent: null,
            isLoading: false,
            error: null,
          });
          persistThread();
          return;
        }

        const nextSuggestions = [...get().pendingSuggestions];
        const nextPreviews = [...get().pendingPreviews];
        if (parsedResponse.kind === "patch" && parsedResponse.patch) {
          const suggestion: PendingSuggestion = {
            id: crypto.randomUUID(),
            messageId: assistantMessageId,
            patch: parsedResponse.patch,
            status: "pending",
          };
          nextSuggestions.push(suggestion);

          const addNodeActions = parsedResponse.patch.actions.filter(
            (action) => action.type === "ADD_NODE",
          );
          const addEdgeActions = parsedResponse.patch.actions.filter(
            (action) => action.type === "ADD_EDGE",
          );

          const previewNodeIds: string[] = [];
          const previewEdgeIds: string[] = [];

          const nameToIdMap = new Map<string, string>();
          const nodesMissingPosition: string[] = [];

          for (const action of addNodeActions) {
            const applied = applyDiagramPatchAction(action);
            if (applied.addedNodeId) {
              previewNodeIds.push(applied.addedNodeId);
              const name = action.payload.name?.trim();
              if (name) {
                nameToIdMap.set(name.toLowerCase(), applied.addedNodeId);
              }
              if (!action.payload.position) {
                nodesMissingPosition.push(applied.addedNodeId);
              }
            }
          }

          for (const action of addEdgeActions) {
            const resolvedSourceId = resolveRef(action.payload.sourceId, nameToIdMap);
            const resolvedTargetId = resolveRef(action.payload.targetId, nameToIdMap);
            if (resolvedSourceId.startsWith("@ref:") || resolvedTargetId.startsWith("@ref:")) {
              console.warn(
                "[LLM] Unresolved @ref in ADD_EDGE - action skipped",
                action.payload.sourceId,
                action.payload.targetId,
              );
              continue;
            }
            const applied = applyDiagramPatchAction({
              ...action,
              payload: {
                ...action.payload,
                sourceId: resolvedSourceId,
                targetId: resolvedTargetId,
              },
            });
            if (applied.addedEdgeId) {
              previewEdgeIds.push(applied.addedEdgeId);
            }
          }

          if (nodesMissingPosition.length > 0) {
            const diagramState = useDiagramStore.getState();
            const activeDiagramId = diagramState.activeDiagramId;
            const activeDiagram = activeDiagramId ? diagramState.diagrams[activeDiagramId] : null;
            const viewport = activeDiagram?.viewport ?? { x: 0, y: 0, zoom: 1 };
            const startX = 200 - viewport.x;
            const startY = 200 - viewport.y;
            const gridPositions = computeGridPositions(nodesMissingPosition.length, startX, startY);
            for (let index = 0; index < nodesMissingPosition.length; index += 1) {
              const nodeId = nodesMissingPosition[index];
              const pos = gridPositions[index];
              if (!nodeId || !pos) continue;
              diagramState.updateNodeLayout(nodeId, pos);
            }
          }

          nextPreviews.push({
            suggestionId: suggestion.id,
            nodeIds: previewNodeIds,
            edgeIds: previewEdgeIds,
          });
        }

        set({
          messages: get().messages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content:
                    parsedResponse.kind === "patch" || parsedResponse.kind === "text"
                      ? parsedResponse.message
                      : "",
                }
              : message,
          ),
          pendingSuggestions: nextSuggestions,
          pendingPreviews: nextPreviews,
          pendingAnalysis: null,
          streamingContent: null,
          isLoading: false,
          error: null,
        });
        persistThread();
      } catch (error) {
        const errorKind: LLMErrorKind = error instanceof LLMProviderError ? error.kind : "unknown";
        set({
          messages: outgoingMessages,
          streamingContent: null,
          isLoading: false,
          error: errorKind,
        });
        persistThread();
      }
    },

    acceptSuggestion: (suggestionId) => {
      const suggestion = get().pendingSuggestions.find(
        (candidateSuggestion) => candidateSuggestion.id === suggestionId,
      );
      if (!suggestion || suggestion.status !== "pending") {
        return;
      }

      ensureHistoryBoundary();

      const patchActions = suggestion.patch.actions;
      for (const action of patchActions) {
        if (action.type === "ADD_NODE" || action.type === "ADD_EDGE") {
          continue;
        }
        applyDiagramPatchAction(action);
      }

      set((state) => ({
        pendingSuggestions: state.pendingSuggestions.map((candidateSuggestion) =>
          candidateSuggestion.id === suggestionId
            ? { ...candidateSuggestion, status: "accepted" }
            : candidateSuggestion,
        ),
        pendingPreviews: state.pendingPreviews.filter(
          (pendingPreview) => pendingPreview.suggestionId !== suggestionId,
        ),
      }));
    },

    rejectSuggestion: (suggestionId) => {
      const suggestion = get().pendingSuggestions.find(
        (candidateSuggestion) => candidateSuggestion.id === suggestionId,
      );
      if (!suggestion || suggestion.status !== "pending") {
        return;
      }

      const preview = get().pendingPreviews.find(
        (pendingPreview) => pendingPreview.suggestionId === suggestionId,
      );

      ensureHistoryBoundary();
      if (preview) {
        for (const edgeId of preview.edgeIds) {
          applyDiagramPatchAction({ type: "REMOVE_EDGE", payload: { edgeId } });
        }
        for (const nodeId of preview.nodeIds) {
          applyDiagramPatchAction({ type: "REMOVE_NODE", payload: { nodeId } });
        }
      }

      set((state) => ({
        pendingSuggestions: state.pendingSuggestions.map((candidateSuggestion) =>
          candidateSuggestion.id === suggestionId
            ? { ...candidateSuggestion, status: "rejected" }
            : candidateSuggestion,
        ),
        pendingPreviews: state.pendingPreviews.filter(
          (pendingPreview) => pendingPreview.suggestionId !== suggestionId,
        ),
      }));
    },

    clearHistory: () => {
      const { activeDiagramId } = get();
      if (activeDiagramId) {
        get().createThread(activeDiagramId);
      } else {
        set({
          messages: [],
          pendingSuggestions: [],
          pendingPreviews: [],
          pendingAnalysis: null,
          streamingContent: null,
          error: null,
          isLoading: false,
        });
      }
    },

    dismissPendingAnalysis: () => {
      set({ pendingAnalysis: null });
    },
  };
});

export function getSuggestionForMessage(
  pendingSuggestions: PendingSuggestion[],
  messageId: string,
): PendingSuggestion | null {
  return (
    pendingSuggestions.find(
      (suggestion) => suggestion.messageId === messageId && suggestion.status === "pending",
    ) ?? null
  );
}

export function summarizePatchActions(patch: DiagramPatch): string[] {
  return patch.actions.map((action) => {
    switch (action.type) {
      case "ADD_NODE":
        return `ADD_NODE ${action.payload.nodeType} ${action.payload.name}`;
      case "REMOVE_NODE":
        return `REMOVE_NODE ${action.payload.nodeId}`;
      case "UPDATE_NODE":
        return `UPDATE_NODE ${action.payload.nodeId}`;
      case "ADD_EDGE":
        return `ADD_EDGE ${action.payload.sourceId} -> ${action.payload.targetId}`;
      case "REMOVE_EDGE":
        return `REMOVE_EDGE ${action.payload.edgeId}`;
      default:
        return "UNKNOWN_ACTION";
    }
  });
}

export function getPendingNodeIds(pendingPreviews: PendingNodePreview[]): Set<string> {
  return new Set(pendingPreviews.flatMap((pendingPreview) => pendingPreview.nodeIds));
}

export function getPendingEdgeIds(pendingPreviews: PendingNodePreview[]): Set<string> {
  return new Set(pendingPreviews.flatMap((pendingPreview) => pendingPreview.edgeIds));
}

export function getSuggestionIdForNode(
  pendingPreviews: PendingNodePreview[],
  nodeId: string,
): string | null {
  return (
    pendingPreviews.find((pendingPreview) => pendingPreview.nodeIds.includes(nodeId))
      ?.suggestionId ?? null
  );
}
