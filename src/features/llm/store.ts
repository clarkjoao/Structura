import { create } from "zustand";
import { useDiagramStore } from "@/features/diagram";
import i18n from "@/infrastructure/i18n";
import { buildSystemPrompt } from "./prompt-builder";
import { parseLLMResponse } from "./patch-parser";
import { toLLMError, type LLMError } from "./errors";
import { deriveThreadTitle } from "./llm-storage";
import { appendTextDelta, getMessageText, suggestionPart, textPart } from "./message-parts";
import type {
  AnalysisResponse,
  ChatMessage,
  ConversationThread,
  DiagramThreadState,
  LLMCompletion,
  LLMConfig,
  LLMConnection,
  LLMRequestMessage,
  PendingNodePreview,
  PendingSuggestion,
} from "./types";
import {
  defaultLLMConnection,
  hydrateChatThreadsCacheFromIdb,
  isChatThreadsHydrated,
  loadConnections,
  loadThreadsForDiagram,
  saveConnections,
  saveThreadsForDiagram,
} from "./llm-storage";
import {
  applyDiagramPatchAction,
  computeGridPositions,
  resolveRef,
  runCatalogReadActions,
} from "./apply-diagram-patch";
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

function buildPatchMessage(actionCount: number): string {
  if (actionCount === 0) {
    return i18n.t("llmChat.patch.none");
  }
  return i18n.t("llmChat.patch.proposed", { count: actionCount });
}

/**
 * The conversation as the provider sees it: each message's text. An older
 * assistant reply stored as a raw JSON envelope is reduced to its summary.
 * Turns with no text (a failed or a stopped-before-anything turn) are left out.
 */
function toRequestMessages(messages: ChatMessage[]): LLMRequestMessage[] {
  return messages
    .map((message): LLMRequestMessage => {
      const text = getMessageText(message);
      if (message.role !== "assistant") {
        return { role: message.role, content: text };
      }
      return { role: "assistant", content: summarizeAssistantText(text) };
    })
    .filter((message) => message.content.trim().length > 0);
}

function summarizeAssistantText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return text;
  }
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed.mode === "analysis" && typeof parsed.summary === "string") {
      return parsed.summary;
    }
    if (typeof parsed.message === "string") {
      return parsed.message;
    }
  } catch (err) {
    console.warn("[llm-store] Failed to parse summary from JSON:", err);
  }
  return i18n.t("llmChat.previousSuggestion");
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
  const lang = getResolvedAppLanguage();
  const isEN = lang === "en";
  const stamp = new Date().toLocaleDateString(isEN ? "en-US" : "pt-BR", {
    day: "2-digit",
    month: "short",
  });
  return i18n.t("llmChat.threads.defaultTitle", { date: stamp });
}

async function executeLLMMessage(
  config: LLMConfig,
  messages: LLMRequestMessage[],
  systemPrompt: string,
  onChunk: (chunk: string) => void,
): Promise<LLMCompletion> {
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
  error: LLMError | null;

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
  /**
   * Boot-time hydration: load every diagram's threads from IndexedDB into
   * the in-memory cache once. Idempotent — calling it twice in the same
   * session is a no-op. Safe to call before `loadHistoryForDiagram` so the
   * panel renders synchronously on first paint.
   */
  initChatThreads: () => Promise<void>;

  sendMessage: (userText: string, diagramContext: string) => Promise<void>;
  acceptSuggestion: (suggestionId: string) => void;
  rejectSuggestion: (suggestionId: string) => void;
  dismissPendingAnalysis: () => void;
  /**
   * @deprecated Replaced by `createThread`. Kept for the panel until Fase 6.
   */
  clearHistory: () => void;
}

/**
 * Writes `messages` into the active thread and returns the next
 * `threadsByDiagram`, or null when there is no active thread to write to. The
 * caller commits the result through `set()` so subscribers (the history drawer)
 * see the change.
 */
function persistActiveThread(
  state: LLMStoreState,
  messages: ChatMessage[] = state.messages,
): Record<string, DiagramThreadState> | null {
  const { activeDiagramId, activeThreadId, threadsByDiagram } = state;
  if (!activeDiagramId || !activeThreadId) {
    return null;
  }
  const entry = threadsByDiagram[activeDiagramId];
  if (!entry) {
    return null;
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
  return { ...threadsByDiagram, [activeDiagramId]: nextEntry };
}

function hasActiveThread(state: LLMStoreState): boolean {
  const { activeDiagramId, activeThreadId, threadsByDiagram } = state;
  if (!activeDiagramId || !activeThreadId) {
    return false;
  }
  return (
    threadsByDiagram[activeDiagramId]?.threads.some((thread) => thread.id === activeThreadId) ??
    false
  );
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

  const persistThread = (messages?: ChatMessage[]) => {
    const next = persistActiveThread(get(), messages);
    if (next) {
      set({ threadsByDiagram: next });
    }
  };

  /**
   * A conversation started from the empty state has no thread yet. Create one
   * before the request so the first message is persisted like any other.
   */
  const ensureActiveThread = (firstUserMessage: string) => {
    if (hasActiveThread(get())) {
      return;
    }
    const diagramId = get().activeDiagramId ?? useDiagramStore.getState().activeDiagramId;
    if (diagramId) {
      get().createThread(diagramId, firstUserMessage);
    }
  };
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
      const duplicate: LLMConnection = {
        ...source,
        id: crypto.randomUUID(),
        name: i18n.t("llmChat.settings.connectionCopyName", { name: source.name }),
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
        const fallback: LLMConnection = { ...defaultLLMConnection(), id: crypto.randomUUID() };
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
              parts: [textPart(firstUserMessage ?? "")],
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

    initChatThreads: () => hydrateChatThreadsCacheFromIdb(),

    sendMessage: async (userText, diagramContext) => {
      if (!userText.trim()) {
        return;
      }
      ensureActiveThread(userText.trim());
      const state = get();

      // If hydration hasn't run yet (panel mounted before App shell's
      // useEffect), kick it off so the next call to `loadThreadsForDiagram`
      // hits the cache.
      if (!isChatThreadsHydrated()) {
        void hydrateChatThreadsCacheFromIdb();
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [textPart(userText.trim())],
        timestamp: Date.now(),
      };
      const outgoingMessages = [...state.messages, userMessage];
      const assistantMessageId = crypto.randomUUID();
      const placeholderMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        parts: [textPart("")],
        timestamp: Date.now(),
        status: "streaming",
      };
      set({
        messages: [...outgoingMessages, placeholderMessage],
        streamingContent: "",
        isLoading: true,
        error: null,
      });
      // Persist the user's message now, not only when the response lands: a
      // slow or failing request must not leave the thread looking empty.
      persistThread(outgoingMessages);

      try {
        const systemPrompt = buildSystemPrompt(diagramContext, getResolvedAppLanguage());
        const sanitizedMessages = toRequestMessages(outgoingMessages);
        let fullResponse = "";
        const { text: rawAssistantResponse } = await executeLLMMessage(
          state.config,
          sanitizedMessages,
          systemPrompt,
          (chunk) => {
            fullResponse += chunk;
            // A JSON envelope (patch or analysis) is not readable while it
            // streams; its text part stays empty until the response is parsed.
            const looksLikeJsonEnvelope = fullResponse.trim().startsWith("{");
            set((streamingState) => ({
              streamingContent: fullResponse,
              messages: looksLikeJsonEnvelope
                ? streamingState.messages
                : streamingState.messages.map((message) =>
                    message.id === assistantMessageId ? appendTextDelta(message, chunk) : message,
                  ),
            }));
          },
        );
        const parsedResponse = parseLLMResponse(rawAssistantResponse);

        if (parsedResponse.kind === "analysis") {
          set({
            messages: get().messages.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    parts: [textPart(parsedResponse.analysis.summary)],
                    status: "complete",
                  }
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
        const catalogToolResults: unknown[] = [];
        let suggestionId: string | null = null;
        if (parsedResponse.kind === "patch" && parsedResponse.patch) {
          const suggestion: PendingSuggestion = {
            id: crypto.randomUUID(),
            messageId: assistantMessageId,
            patch: parsedResponse.patch,
            status: "pending",
          };
          nextSuggestions.push(suggestion);
          suggestionId = suggestion.id;

          const addNodeActions = parsedResponse.patch.actions.filter(
            (action) => action.type === "ADD_NODE",
          );
          const addEdgeActions = parsedResponse.patch.actions.filter(
            (action) => action.type === "ADD_EDGE",
          );

          // F8b: catalog reads first so search_elements hits can gate ADD_NODE
          // in the same turn (no multi-turn model loop required).
          const { catalogToolResults: earlyCatalogResults } = runCatalogReadActions(
            parsedResponse.patch.actions,
          );
          catalogToolResults.push(...earlyCatalogResults);

          const previewNodeIds: string[] = [];
          const previewEdgeIds: string[] = [];

          const nameToIdMap = new Map<string, string>();
          const nodesMissingPosition: string[] = [];

          // Pass 1: Create root nodes (no parentId or null parentId)
          for (const action of addNodeActions) {
            const hasParentRef = action.payload.parentId?.startsWith("@ref:");
            if (hasParentRef) continue;

            const applied = applyDiagramPatchAction(action, nameToIdMap);
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

          // Pass 2: Create child nodes (with parentId @ref)
          for (const action of addNodeActions) {
            const hasParentRef = action.payload.parentId?.startsWith("@ref:");
            if (!hasParentRef) continue;

            const applied = applyDiagramPatchAction(action, nameToIdMap);
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
            const applied = applyDiagramPatchAction(
              {
                ...action,
                payload: {
                  ...action.payload,
                  sourceId: resolvedSourceId,
                  targetId: resolvedTargetId,
                },
              },
              nameToIdMap,
            );
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

        let assistantContent =
          parsedResponse.kind === "patch"
            ? buildPatchMessage(parsedResponse.patch?.actions.length ?? 0)
            : parsedResponse.kind === "text"
              ? parsedResponse.message
              : "";
        if (catalogToolResults.length > 0) {
          const catalogBlock = [
            i18n.t("llmChat.patch.catalogResults"),
            "```json",
            JSON.stringify(catalogToolResults, null, 2),
            "```",
          ].join("\n");
          assistantContent = assistantContent
            ? `${assistantContent}\n\n${catalogBlock}`
            : catalogBlock;
        }

        set({
          messages: get().messages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  parts: suggestionId
                    ? [textPart(assistantContent), suggestionPart(suggestionId)]
                    : [textPart(assistantContent)],
                  status: "complete",
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
        const llmError = toLLMError(error, {
          mode: state.config.mode,
          provider: state.config.provider,
        });
        console.error(`[llm] request failed (${llmError.kind})`, error);
        set({
          messages: outgoingMessages,
          streamingContent: null,
          isLoading: false,
          error: llmError,
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

      if (preview && (preview.nodeIds.length > 0 || preview.edgeIds.length > 0)) {
        // Batched so a multi-node suggestion is removed as one undo step,
        // instead of pushing a history checkpoint per removed node/edge.
        useDiagramStore.getState().removeElements(preview.nodeIds, preview.edgeIds);
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

/**
 * Messages that count as part of the conversation. While a request runs,
 * `sendMessage` keeps an assistant placeholder at the end of `messages` for the
 * streamed reply; it is not a message yet, so it is left out.
 */
export function countConversationMessages(messages: ChatMessage[], isLoading: boolean): number {
  const last = messages[messages.length - 1];
  const hasInFlightPlaceholder = isLoading && last !== undefined && last.role === "assistant";
  return hasInFlightPlaceholder ? messages.length - 1 : messages.length;
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
