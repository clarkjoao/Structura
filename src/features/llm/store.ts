import { create } from "zustand";
import type { ToolSet } from "ai";
import type { ToolEvent } from "./transport/ai-sdk-transport";
import { useDiagramStore } from "@/features/diagram";
import i18n from "@/infrastructure/i18n";
import { buildSystemPrompt } from "./prompt-builder";
import { LLMRequestCancelledError, toLLMError } from "./errors";
import { deriveThreadTitle } from "./llm-storage";
import {
  appendPart,
  appendTextDelta,
  errorPart,
  failRunningToolCalls,
  getMessageText,
  suggestionPart,
  textPart,
  updateToolCallPart,
} from "./message-parts";
import type {
  ChatMessage,
  ConversationThread,
  DiagramThreadState,
  LLMCompletion,
  LLMConfig,
  LLMConnection,
  LLMRequestMessage,
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
import { applySuggestion } from "./suggestion-apply";
import { SuggestionDraft } from "./tools/suggestion-draft";
import { createInternalToolRegistry } from "./tools/internal-tools";
import { isToolErrorResult } from "./tools/registry";
import { storeDiagramHost } from "./tools/store-host";

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

/**
 * The single seam between the chat and the model. Routes through the AI SDK
 * transport, which is loaded on first use.
 */
async function executeLLMMessage(
  config: LLMConfig,
  messages: LLMRequestMessage[],
  systemPrompt: string,
  onChunk: (chunk: string) => void,
  signal: AbortSignal,
  tools?: ToolSet,
  onToolEvent?: (event: ToolEvent) => void,
): Promise<LLMCompletion> {
  const { streamChat } = await import("./transport/ai-sdk-transport");
  return streamChat({ config, messages, systemPrompt, onChunk, signal, tools, onToolEvent });
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
  streamingContent: string | null;
  isLoading: boolean;

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
   * Stops the request in flight. What had streamed stays, the message is
   * marked cancelled, and no error is recorded.
   */
  cancelRequest: () => void;
  /**
   * Requests a new reply to the user message before `assistantMessageId`,
   * replacing that assistant message. Retry (after an error) and Regenerate.
   */
  rerunAssistantMessage: (assistantMessageId: string, diagramContext: string) => Promise<void>;
  /**
   * Applies the suggestion as one undo step. Nothing touched the diagram
   * before this; changes that no longer apply are skipped and recorded.
   */
  acceptSuggestion: (suggestionId: string) => Promise<void>;
  rejectSuggestion: (suggestionId: string) => void;
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

/** Turns a transport tool event into the matching change on the message's tool-call parts. */
function applyToolEvent(message: ChatMessage, event: ToolEvent): ChatMessage {
  switch (event.kind) {
    case "call": {
      const tool = internalTools.get(event.name);
      return appendPart(message, {
        type: "tool-call",
        id: event.id,
        name: event.name,
        source: tool?.source ?? "internal",
        ...(tool?.serverId ? { serverId: tool.serverId } : {}),
        args: event.input,
        status: "running",
      });
    }
    case "result":
      return isToolErrorResult(event.output)
        ? updateToolCallPart(message, event.id, {
            status: "error",
            result: event.output,
            error: event.output.error,
          })
        : updateToolCallPart(message, event.id, { status: "done", result: event.output });
    case "error":
      return updateToolCallPart(message, event.id, { status: "error", error: event.error });
  }
}

/** The tools every turn offers the model. */
const internalTools = createInternalToolRegistry();

export const useLLMStore = create<LLMStoreState>((set, get) => {
  const initialConnections = loadConnections();
  const initialConnection =
    initialConnections.connections.find(
      (connection) => connection.id === initialConnections.activeConnectionId,
    ) ?? initialConnections.connections[0];

  if (!initialConnection) {
    throw new Error("loadConnections returned no connections");
  }

  /** Aborts the request in flight; not state, so it lives outside `set()`. */
  let inFlight: AbortController | null = null;

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

  /**
   * Requests the assistant's reply to `outgoingMessages` (which ends with the
   * user's message): appends a streaming assistant message, streams into it,
   * then completes, cancels or fails it in place.
   */
  const runAssistantTurn = async (
    outgoingMessages: ChatMessage[],
    diagramContext: string,
  ): Promise<void> => {
    const state = get();
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
    });
    // Persist the user's message now, not only when the response lands: a
    // slow or failing request must not leave the thread looking empty.
    persistThread(outgoingMessages);

    const controller = new AbortController();
    inFlight = controller;
    try {
      const systemPrompt = buildSystemPrompt(diagramContext, getResolvedAppLanguage());
      const requestMessages = toRequestMessages(outgoingMessages);
      // Write tools queue into this draft; it becomes the turn's one suggestion.
      const suggestionDraft = new SuggestionDraft();
      const tools = internalTools.toToolSet({
        host: storeDiagramHost,
        suggestion: suggestionDraft,
      });
      let fullResponse = "";
      const { stopReason } = await executeLLMMessage(
        state.config,
        requestMessages,
        systemPrompt,
        (chunk) => {
          fullResponse += chunk;
          set((streamingState) => ({
            streamingContent: fullResponse,
            messages: streamingState.messages.map((message) =>
              message.id === assistantMessageId ? appendTextDelta(message, chunk) : message,
            ),
          }));
        },
        controller.signal,
        tools,
        (event) => {
          set((streamingState) => ({
            messages: streamingState.messages.map((message) =>
              message.id === assistantMessageId ? applyToolEvent(message, event) : message,
            ),
          }));
        },
      );
      // Cut at the output-token ceiling: the reply is kept as it is and the
      // message says so, instead of passing for a complete answer.
      const truncation = stopReason === "length" ? { truncated: true } : {};

      const suggestion: PendingSuggestion | null = suggestionDraft.isEmpty
        ? null
        : {
            id: crypto.randomUUID(),
            messageId: assistantMessageId,
            patch: {
              id: crypto.randomUUID(),
              description: "",
              actions: [...suggestionDraft.actions],
            },
            status: "pending",
          };

      set({
        messages: get().messages.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                parts: suggestion
                  ? [...message.parts, suggestionPart(suggestion.id)]
                  : message.parts,
                status: "complete",
                ...truncation,
              }
            : message,
        ),
        pendingSuggestions: suggestion
          ? [...get().pendingSuggestions, suggestion]
          : get().pendingSuggestions,
        streamingContent: null,
        isLoading: false,
      });
      persistThread();
    } catch (error) {
      if (error instanceof LLMRequestCancelledError) {
        set({
          // Completed calls stay; the running one ends as stopped. The
          // turn's queued changes are dropped with it: no suggestion.
          messages: get().messages.map((message) =>
            message.id === assistantMessageId
              ? { ...failRunningToolCalls(message, true), status: "cancelled" }
              : message,
          ),
          streamingContent: null,
          isLoading: false,
        });
        persistThread();
        return;
      }
      const llmError = toLLMError(error, {
        mode: state.config.mode,
        provider: state.config.provider,
      });
      console.error(`[llm] request failed (${llmError.kind})`, error);
      // The failure belongs to this turn: it stays in the conversation (and in
      // the saved thread) as an error part on the assistant message.
      set({
        messages: get().messages.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                parts: [...failRunningToolCalls(message, false).parts, errorPart(llmError)],
                status: "error",
              }
            : message,
        ),
        streamingContent: null,
        isLoading: false,
      });
      persistThread();
    } finally {
      if (inFlight === controller) {
        inFlight = null;
      }
    }
  };

  return {
    connections: initialConnections.connections,
    activeConnectionId: initialConnection.id,
    config: connectionToConfig(initialConnection),
    threadsByDiagram: {},
    activeDiagramId: null,
    activeThreadId: "",
    messages: [],
    pendingSuggestions: [],
    streamingContent: null,
    isLoading: false,

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
        streamingContent: null,
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
        streamingContent: null,
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
        streamingContent: null,
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
          streamingContent: null,
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
              streamingContent: null,
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
      await runAssistantTurn(outgoingMessages, diagramContext);
    },

    rerunAssistantMessage: async (assistantMessageId, diagramContext) => {
      const { messages, isLoading } = get();
      if (isLoading) {
        return;
      }
      const index = messages.findIndex((message) => message.id === assistantMessageId);
      const target = messages[index];
      const previous = messages[index - 1];
      if (!target || target.role !== "assistant" || !previous || previous.role !== "user") {
        return;
      }
      // Messages after the replaced one (if any) belong to the old branch.
      await runAssistantTurn(messages.slice(0, index), diagramContext);
    },

    cancelRequest: () => {
      inFlight?.abort();
    },

    acceptSuggestion: async (suggestionId) => {
      const suggestion = get().pendingSuggestions.find(
        (candidateSuggestion) => candidateSuggestion.id === suggestionId,
      );
      if (!suggestion || suggestion.status !== "pending") {
        return;
      }

      // Marked first so a second click cannot apply it twice while the
      // layout (if any) runs.
      set((state) => ({
        pendingSuggestions: state.pendingSuggestions.map((candidateSuggestion) =>
          candidateSuggestion.id === suggestionId
            ? { ...candidateSuggestion, status: "accepted" }
            : candidateSuggestion,
        ),
      }));
      const skipped = await applySuggestion(suggestion.patch.actions, storeDiagramHost);
      if (skipped.length > 0) {
        set((state) => ({
          pendingSuggestions: state.pendingSuggestions.map((candidateSuggestion) =>
            candidateSuggestion.id === suggestionId
              ? { ...candidateSuggestion, skipped }
              : candidateSuggestion,
          ),
        }));
      }
    },

    rejectSuggestion: (suggestionId) => {
      const suggestion = get().pendingSuggestions.find(
        (candidateSuggestion) => candidateSuggestion.id === suggestionId,
      );
      if (!suggestion || suggestion.status !== "pending") {
        return;
      }

      set((state) => ({
        pendingSuggestions: state.pendingSuggestions.map((candidateSuggestion) =>
          candidateSuggestion.id === suggestionId
            ? { ...candidateSuggestion, status: "rejected" }
            : candidateSuggestion,
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
          streamingContent: null,
          isLoading: false,
        });
      }
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
