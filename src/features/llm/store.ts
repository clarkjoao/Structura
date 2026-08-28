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
  LLMCompletion,
  LLMConfig,
  LLMConnection,
  PendingNodePreview,
  PendingSuggestion,
} from "./types";
import {
  hydrateChatThreadsCacheFromIdb,
  isChatThreadsHydrated,
  loadConnections,
  loadThreadsForDiagram,
  saveConnections,
  saveThreadsForDiagram,
} from "./llm-storage";
import { applyDiagramPatchAction, computeGridPositions, resolveRef } from "./apply-diagram-patch";
import {
  applyIRToDiagram,
  buildIRSystemPrompt,
  parseAndValidateIR,
  type DiagramIR,
  type IRValidationIssue,
} from "./ir";
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

function buildPatchMessage(locale: string, actionCount: number): string {
  const isPT = locale.toLowerCase().startsWith("pt");
  if (actionCount === 0) {
    return isPT ? "Nenhuma ação proposta." : "No actions proposed.";
  }
  if (actionCount === 1) {
    return isPT ? "Proponho 1 alteração no diagrama." : "I propose 1 diagram change.";
  }
  return isPT
    ? `Proponho ${actionCount} alterações no diagrama.`
    : `I propose ${actionCount} diagram changes.`;
}

/**
 * Renders validation issues as a message the user can act on. Codes map 1:1 to
 * i18n keys so the validator itself carries no user-visible text.
 */
function buildIRIssuesMessage(
  issues: IRValidationIssue[],
  headerKey = "llmChat.ir.invalid",
): string {
  const MAX_LISTED_ISSUES = 8;
  const lines = issues
    .slice(0, MAX_LISTED_ISSUES)
    .map((issue) => `- ${i18n.t(`llmChat.ir.issue.${issue.code}`, { ...issue.params })}`);
  if (issues.length > MAX_LISTED_ISSUES) {
    lines.push(
      `- ${i18n.t("llmChat.ir.moreIssues", { count: issues.length - MAX_LISTED_ISSUES })}`,
    );
  }
  return [i18n.t(headerKey), ...lines].join("\n");
}

/**
 * The response was cut at the provider's output ceiling. This is deliberately
 * not the generic "outside the IR schema" message: the diagram the model was
 * describing may be perfectly well-formed, it just did not fit, and the user's
 * next move is to ask for less rather than to look for a modelling mistake.
 */
function buildTruncatedMessage(): string {
  return buildIRIssuesMessage([{ code: "responseTruncated" }], "llmChat.ir.truncated");
}

/**
 * The IR is the input every later slice debugs against, so it is logged raw
 * alongside the validation outcome and also kept on the store as
 * `lastGeneratedIR` for inspection.
 */
function logGeneratedIR(rawResponse: string, ir: DiagramIR | null): void {
  console.info("[ir] raw model response:", rawResponse);
  if (ir) {
    console.info("[ir] validated IR:", JSON.stringify(ir, null, 2));
  }
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
    } catch (err) {
      console.warn("[llm-store] Failed to parse summary from JSON:", err);
    }
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
  const lang = getResolvedAppLanguage();
  const isEN = lang === "en";
  const stamp = new Date().toLocaleDateString(
    isEN ? "en-US" : "pt-BR",
    { day: "2-digit", month: "short" },
  );
  return isEN ? `Conversation · ${stamp}` : `Conversa · ${stamp}`;
}

async function executeLLMMessage(
  config: LLMConfig,
  messages: ChatMessage[],
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
  error: LLMErrorKind | null;
  /** Last IR the generator produced and the validator accepted, kept for inspection. */
  lastGeneratedIR: DiagramIR | null;

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
  /**
   * Generates a whole diagram from a natural-language description, through the
   * IR pipeline: prompt -> IR -> validation -> ELK layout -> canvas.
   */
  generateDiagramFromIR: (description: string, userText: string) => Promise<void>;
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
    lastGeneratedIR: null,

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

    initChatThreads: () => hydrateChatThreadsCacheFromIdb(),

    sendMessage: async (userText, diagramContext) => {
      if (!userText.trim()) {
        return;
      }
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
        const { text: rawAssistantResponse } = await executeLLMMessage(
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

        const locale = getResolvedAppLanguage();
        set({
          messages: get().messages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content:
                    parsedResponse.kind === "patch"
                      ? buildPatchMessage(locale, parsedResponse.patch?.actions.length ?? 0)
                      : parsedResponse.kind === "text"
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

    generateDiagramFromIR: async (description, userText) => {
      const state = get();

      if (!isChatThreadsHydrated()) {
        void hydrateChatThreadsCacheFromIdb();
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: userText.trim(),
        timestamp: Date.now(),
      };
      const outgoingMessages = [...state.messages, userMessage];

      const trimmedDescription = description.trim();
      if (!trimmedDescription) {
        set({
          messages: [
            ...outgoingMessages,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: i18n.t("llmChat.ir.commandHint"),
              timestamp: Date.now(),
            },
          ],
          streamingContent: null,
          isLoading: false,
          error: null,
        });
        persistThread();
        return;
      }

      const assistantMessageId = crypto.randomUUID();
      set({
        messages: [
          ...outgoingMessages,
          { id: assistantMessageId, role: "assistant", content: "", timestamp: Date.now() },
        ],
        streamingContent: "",
        isLoading: true,
        error: null,
      });

      const finishWith = (content: string) => {
        set({
          messages: get().messages.map((message) =>
            message.id === assistantMessageId ? { ...message, content } : message,
          ),
          streamingContent: null,
          isLoading: false,
        });
        persistThread();
      };

      try {
        const systemPrompt = buildIRSystemPrompt(getResolvedAppLanguage());
        let streamed = "";
        const { text: rawResponse, stopReason } = await executeLLMMessage(
          state.config,
          [{ ...userMessage, content: trimmedDescription }],
          systemPrompt,
          (chunk) => {
            // A partial IR is not renderable, so only the progress indicator
            // reacts to streaming — the message body stays empty until the end.
            streamed += chunk;
            set({ streamingContent: streamed });
          },
        );

        // Checked before parsing: a response the provider cut at its output
        // ceiling is incomplete whatever it looks like, and running it through
        // the validator would only produce `invalidJson`, which points the user
        // at the wrong problem.
        if (stopReason === "length") {
          logGeneratedIR(rawResponse, null);
          set({ lastGeneratedIR: null });
          finishWith(buildTruncatedMessage());
          return;
        }

        const validation = parseAndValidateIR(rawResponse);
        if (!validation.ok) {
          logGeneratedIR(rawResponse, null);
          set({ lastGeneratedIR: null });
          finishWith(buildIRIssuesMessage(validation.issues));
          return;
        }

        logGeneratedIR(rawResponse, validation.ir);
        set({ lastGeneratedIR: validation.ir });

        if (!useDiagramStore.getState().activeDiagramId) {
          finishWith(i18n.t("llmChat.ir.noActiveDiagram"));
          return;
        }

        const applied = await applyIRToDiagram(validation.ir);
        if (applied.componentIds.length === 0) {
          finishWith(i18n.t("llmChat.ir.notApplied"));
          return;
        }

        const appliedMessage = i18n.t("llmChat.ir.applied", {
          nodeCount: applied.componentIds.length,
          edgeCount: applied.connectionIds.length,
        });

        // Generated nodes/edges are already on the canvas (insertGeneratedGraph
        // applied them as a single undo step) — stage them as a pending
        // suggestion so the user gets the same Accept/Reject + canvas
        // Keep/Discard flow as a normal chat patch, instead of the result
        // being final immediately.
        const suggestion: PendingSuggestion = {
          id: crypto.randomUUID(),
          messageId: assistantMessageId,
          patch: { id: crypto.randomUUID(), description: appliedMessage, actions: [] },
          status: "pending",
        };
        set({
          pendingSuggestions: [...get().pendingSuggestions, suggestion],
          pendingPreviews: [
            ...get().pendingPreviews,
            {
              suggestionId: suggestion.id,
              nodeIds: applied.componentIds,
              edgeIds: applied.connectionIds,
            },
          ],
        });

        finishWith(appliedMessage);
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
