import { create } from "zustand";
import type { ToolSet } from "ai";
import type { ToolEvent } from "./transport/ai-sdk-transport";
import type { Diagram } from "@/features/diagram";
import { buildMentionContextBlock } from "./mentions/context-block";
import type { MentionRef } from "./mentions/mention-ref";
import type { SkillRef } from "./skills/skill.types";
import { useSkillStore } from "./skills/skill-store";
import {
  buildSkillInstructionsBlock,
  resolveActiveSkills,
  skillToolAllowlist,
} from "./skills/skill-request";
import { commandRegistry } from "./commands/builtins";
import { isPromptCommand } from "./commands/registry";
import { useDiagramStore } from "@/features/diagram";
import i18n from "@/infrastructure/i18n";
import { MCP_RESULTS_RULE, buildSystemPrompt } from "./prompt-builder";
import { useMcpStore } from "./mcp/mcp-store";
import { LLMRequestCancelledError, toLLMError } from "./errors";
import { deriveThreadTitle } from "./llm-storage";
import {
  appendPart,
  appendTextDelta,
  errorPart,
  failRunningToolCalls,
  getMessageText,
  getVisibleText,
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
  CommandRef,
  PendingNodePreview,
  PendingSuggestion,
  QueuedMessage,
} from "./types";
import { MAX_QUEUED_MESSAGES } from "./types";
import {
  defaultLLMConnection,
  hydrateChatThreadsCacheFromIdb,
  isChatThreadsHydrated,
  defaultConnectionsPayload,
  loadConnections,
  type ConnectionsPayload,
  loadThreadsForDiagram,
  saveConnections,
  saveThreadsForDiagram,
} from "./llm-storage";
import { applySuggestion } from "./suggestion-apply";
import { SuggestionDraft } from "./tools/suggestion-draft";
import { isToolErrorResult, type ToolRegistry } from "./tools/registry";
import type { DiagramToolHost } from "./tools/host";
import { loadInternalTools } from "./tools/load-internal-tools";

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
function toRequestMessages(messages: ChatMessage[], diagram: Diagram | null): LLMRequestMessage[] {
  return messages
    .map((message): LLMRequestMessage => {
      const text = getMessageText(message);
      if (message.role !== "assistant") {
        return { role: message.role, content: userTurnContent(message, text, diagram) };
      }
      return { role: "assistant", content: summarizeAssistantText(text) };
    })
    .filter((message) => message.content.trim().length > 0);
}

/**
 * A user turn as the model sees it: the text, then the attached refs resolved
 * against the current diagram as a JSON block. Old messages have no refs.
 */
function userTurnContent(message: ChatMessage, text: string, diagram: Diagram | null): string {
  const block = buildMentionContextBlock(message.mentions ?? [], diagram);
  return [commandInstruction(message), text, block]
    .filter((section) => section.trim().length > 0)
    .join("\n\n");
}

/**
 * The instruction of the prompt command a message was sent with. A command
 * that no longer exists contributes its visible "/name" instead.
 */
function commandInstruction(message: ChatMessage): string {
  if (!message.command) return "";
  const command = commandRegistry.get(message.command.id);
  return command && isPromptCommand(command) ? command.instruction : `/${message.command.name}`;
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
    ...(connection.customProtocol ? { customProtocol: connection.customProtocol } : {}),
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

/** What a user message carries besides its text. */
export interface MessageAttachments {
  mentions?: MentionRef[];
  /** A prompt command chip; the text is the user's extra text. */
  command?: CommandRef;
  /** The skill chips active when the message was sent. */
  skills?: SkillRef[];
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
  /** Pending suggestions drawn on the canvas, waiting for Accept or Reject. */
  pendingPreviews: PendingNodePreview[];
  streamingContent: string | null;
  isLoading: boolean;
  /**
   * The diagram context the composer most recently sent with. Drained
   * messages reuse it because the React side that builds the context is not
   * re-invoked on drain.
   */
  lastDiagramContext: string;

  /** True once the stored connections have been read. */
  connectionsLoaded: boolean;
  /** Reads the stored connections (migrating the old keys once). Called at startup. */
  hydrateConnections: () => Promise<void>;
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

  sendMessage: (
    userText: string,
    diagramContext: string,
    attachments?: MessageAttachments,
  ) => Promise<boolean>;
  /**
   * Stops the request in flight. What had streamed stays, the message is
   * marked cancelled, and no error is recorded.
   */
  cancelRequest: () => void;
  /**
   * Composer queue: messages enqueued while the assistant is busy. It belongs
   * to the active thread, so switching, creating, deleting or clearing a
   * thread, or opening another diagram, empties it.
   */
  queuedMessages: QueuedMessage[];
  /**
   * Removes one queued message by id. A no-op when the id is unknown. The
   * composer shows a chip per queued message; clicking the chip's X calls this.
   */
  removeQueuedMessage: (id: string) => void;
  /** Set by the canvas hosting the chat; null when none is mounted. */
  setToolHost: (host: DiagramToolHost | null) => void;
  /**
   * Set by the chat hook: builds the diagram context for a turn the store
   * starts on its own (a drained queued message). Null when no chat is mounted.
   */
  setDiagramContextSource: (source: (() => string) | null) => void;
  /**
   * Requests a new reply to the user message before `assistantMessageId`,
   * replacing that assistant message. Retry (after an error) and Regenerate.
   */
  rerunAssistantMessage: (assistantMessageId: string, diagramContext: string) => Promise<void>;
  /**
   * Keeps the suggestion. It is on the canvas already as a preview (one undo
   * step); when the preview is gone (undone, or there was none) it is applied
   * now, as one undo step.
   */
  acceptSuggestion: (suggestionId: string) => Promise<void>;
  /** Drops the suggestion and takes its preview off the canvas. */
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
function applyToolEvent(
  message: ChatMessage,
  event: ToolEvent,
  registry: ToolRegistry,
): ChatMessage {
  switch (event.kind) {
    case "call": {
      const tool = registry.get(event.name);
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

export const useLLMStore = create<LLMStoreState>((set, get) => {
  // A default until `hydrateConnections` reads the stored ones (async: the
  // storage port is async).
  const initialConnections = defaultConnectionsPayload();
  const initialConnection =
    initialConnections.connections.find(
      (connection) => connection.id === initialConnections.activeConnectionId,
    ) ?? initialConnections.connections[0];

  if (!initialConnection) {
    throw new Error("defaultConnectionsPayload returned no connections");
  }

  /** Set once the user changes connections, so a late hydration cannot undo it. */
  let connectionsTouched = false;
  const persistConnections = (payload: ConnectionsPayload) => {
    connectionsTouched = true;
    void saveConnections(payload).catch((err: unknown) => {
      console.warn("[llm] could not save the connections", err);
    });
  };

  /** Aborts the request in flight; not state, so it lives outside `set()`. */
  let inFlight: AbortController | null = null;
  /**
   * How tools and Accept reach the diagram, provided by the canvas that hosts
   * the chat (`useProvideChatToolHost`). A dependency, not state.
   */
  let toolHost: DiagramToolHost | null = null;
  /** Builds the current diagram context; see `setDiagramContextSource`. */
  let diagramContextSource: (() => string) | null = null;

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
      // The thread is created for this conversation's first send, so the
      // queue typed for it stays.
      const { queuedMessages } = get();
      get().createThread(diagramId, firstUserMessage);
      set({ queuedMessages });
    }
  };
  const setWithPersist = (partial: Partial<LLMStoreState>) => set(partial);

  /**
   * Previews still being drawn (the layout is async), by suggestion id: Accept
   * and Reject wait for them, so a quick click cannot apply a suggestion twice.
   */
  const previewsInFlight = new Map<string, Promise<void>>();

  const setSuggestion = (suggestionId: string, patch: Partial<PendingSuggestion>) => {
    set((state) => ({
      pendingSuggestions: state.pendingSuggestions.map((candidate) =>
        candidate.id === suggestionId ? { ...candidate, ...patch } : candidate,
      ),
      pendingPreviews: state.pendingPreviews.filter(
        (preview) => patch.status === undefined || preview.suggestionId !== suggestionId,
      ),
    }));
  };

  /**
   * Draws a new suggestion on the canvas: applied as one undo step, its
   * elements marked pending until Accept or Reject.
   */
  const previewSuggestion = (suggestion: PendingSuggestion): Promise<void> => {
    const running = drawPreview(suggestion).finally(() => {
      previewsInFlight.delete(suggestion.id);
    });
    previewsInFlight.set(suggestion.id, running);
    return running;
  };

  const drawPreview = async (suggestion: PendingSuggestion): Promise<void> => {
    const host = toolHost;
    if (!host) return;
    try {
      const applied = await applySuggestion(suggestion.patch.actions, host);
      set((state) => ({
        pendingPreviews: [
          ...state.pendingPreviews,
          {
            suggestionId: suggestion.id,
            nodeIds: applied.addedNodeIds,
            edgeIds: applied.addedEdgeIds,
            receipt: applied.receipt,
          },
        ],
        pendingSuggestions: state.pendingSuggestions.map((candidate) =>
          candidate.id === suggestion.id && applied.skipped.length > 0
            ? { ...candidate, skipped: applied.skipped }
            : candidate,
        ),
      }));
    } catch (err) {
      console.error("[llm] could not preview the suggestion", err);
    }
  };

  /** Whether the preview's changes are still on the diagram. */
  const isPreviewApplied = (preview: PendingNodePreview, host: DiagramToolHost): boolean => {
    if (preview.receipt && host.isInHistory(preview.receipt)) return true;
    const components = host.readDiagram()?.snapshot.components ?? {};
    return preview.nodeIds.some((id) => id in components);
  };

  /** Takes a preview off the canvas: reverted as if it never ran, or its additions removed. */
  const discardPreview = (preview: PendingNodePreview) => {
    const host = toolHost;
    if (!host) return;
    if (preview.receipt && host.revertChanges(preview.receipt)) return;
    if (!isPreviewApplied(preview, host)) return;
    const snapshot = host.readDiagram()?.snapshot;
    const nodeIds = preview.nodeIds.filter((id) => id in (snapshot?.components ?? {}));
    const edgeIds = preview.edgeIds.filter((id) => id in (snapshot?.connections ?? {}));
    if (nodeIds.length > 0 || edgeIds.length > 0) {
      host.removeElements(nodeIds, edgeIds);
    }
  };

  /** Rejects every previewed suggestion: called when the conversation they belong to is left. */
  const discardAllPreviews = () => {
    for (const preview of [...get().pendingPreviews].reverse()) {
      discardPreview(preview);
    }
    set({ pendingPreviews: [] });
  };

  /**
   * Pops the next queued message, if any, and runs it as a regular turn.
   * Called when a turn completes. The context is built now, so
   * the turn sees changes made while it waited (an accepted suggestion, an
   * edit); without a context source it falls back to the last one sent.
   * No-op when the queue is empty.
   */
  const drainQueue = async (): Promise<void> => {
    const [next, ...rest] = get().queuedMessages;
    if (!next) return;
    set({ queuedMessages: rest });
    // sendMessage runs the turn directly (isLoading is now false).
    const diagramContext = diagramContextSource?.() ?? get().lastDiagramContext;
    await get().sendMessage(next.text, diagramContext, {
      mentions: next.mentions,
      ...(next.command ? { command: next.command } : {}),
      ...(next.skills.length > 0 ? { skills: next.skills } : {}),
    });
  };

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
    // Only a turn that completed sends the queue on. A cancelled or failed
    // turn keeps it, so one error is shown once instead of once per queued
    // message; the next send or a retry that completes sends it.
    let completed = false;
    try {
      // The turn's skills are the ones its user message was sent with, so a
      // retry reuses them. A skill that no longer exists is left out.
      const turnMessage = [...outgoingMessages]
        .reverse()
        .find((message) => message.role === "user");
      const skills = resolveActiveSkills(turnMessage?.skills, useSkillStore.getState().skills);
      const systemPrompt = [
        buildSystemPrompt(diagramContext, getResolvedAppLanguage()),
        MCP_RESULTS_RULE,
        buildSkillInstructionsBlock(skills),
      ]
        .filter((section) => section.length > 0)
        .join("\n\n");
      const requestMessages = toRequestMessages(outgoingMessages, toolHost?.readDiagram() ?? null);
      // Write tools queue into this draft; it becomes the turn's one suggestion.
      const suggestionDraft = new SuggestionDraft();
      const host = toolHost;
      // Without a host (no canvas mounted) the model answers without tools.
      const internalTools = await loadInternalTools();
      // Connected MCP servers add their (non-blocked) tools to this turn.
      const mcpTools = useMcpStore.getState().toolDefinitionsForTurn();
      const registry = mcpTools.length > 0 ? internalTools.with(mcpTools) : internalTools;
      // Skill allowlists narrow the tools on the registry, before the SDK sees them.
      const allowlist = skillToolAllowlist(skills);
      const toolSet = host
        ? registry.toToolSet(
            { host, suggestion: suggestionDraft },
            allowlist ? { names: allowlist } : {},
          )
        : undefined;
      const tools = toolSet && Object.keys(toolSet).length > 0 ? toolSet : undefined;
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
              message.id === assistantMessageId
                ? applyToolEvent(message, event, registry)
                : message,
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
      if (suggestion) {
        await previewSuggestion(suggestion);
      }
      completed = true;
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
      if (completed) {
        await drainQueue();
      }
    }
  };

  return {
    connections: initialConnections.connections,
    activeConnectionId: initialConnection.id,
    config: connectionToConfig(initialConnection),
    connectionsLoaded: false,
    threadsByDiagram: {},
    activeDiagramId: null,
    activeThreadId: "",
    messages: [],
    pendingSuggestions: [],
    pendingPreviews: [],
    streamingContent: null,
    isLoading: false,
    queuedMessages: [],
    lastDiagramContext: "",

    hydrateConnections: async () => {
      const payload = await loadConnections();
      if (connectionsTouched) {
        set({ connectionsLoaded: true });
        return;
      }
      const active =
        payload.connections.find((connection) => connection.id === payload.activeConnectionId) ??
        payload.connections[0];
      if (!active) return;
      set({
        connections: payload.connections,
        activeConnectionId: active.id,
        config: connectionToConfig(active),
        connectionsLoaded: true,
      });
    },

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
              ...(config.customProtocol !== undefined
                ? { customProtocol: config.customProtocol }
                : {}),
              ...(config.extraHeaders !== undefined ? { extraHeaders: config.extraHeaders } : {}),
              ...(config.extraParams !== undefined ? { extraParams: config.extraParams } : {}),
            }
          : connection,
      );
      persistConnections({ connections: updated, activeConnectionId });
      set({ connections: updated, config });
    },

    setActiveConnection: (id) => {
      const next = get().connections.find((connection) => connection.id === id);
      if (!next) {
        return;
      }
      persistConnections({ connections: get().connections, activeConnectionId: id });
      set({ activeConnectionId: id, config: connectionToConfig(next) });
    },

    createConnection: (draft) => {
      const id = draft.id ?? crypto.randomUUID();
      const connection: LLMConnection = { ...draft, id };
      const updated = [...get().connections, connection];
      persistConnections({ connections: updated, activeConnectionId: id });
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
      persistConnections({ connections: updated, activeConnectionId: get().activeConnectionId });
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
      persistConnections({ connections: updated, activeConnectionId: get().activeConnectionId });
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
        persistConnections({ connections: updated, activeConnectionId: fallback.id });
        set({
          connections: updated,
          activeConnectionId: fallback.id,
          config: connectionToConfig(fallback),
        });
        return true;
      }
      persistConnections({ connections: updated, activeConnectionId });
      set({ connections: updated });
      return true;
    },

    loadHistoryForDiagram: (diagramId) => {
      const state = loadThreadsForDiagram(diagramId);
      const threads = state.threads;
      const activeThreadId =
        threads.find((thread) => thread.id === state.activeThreadId)?.id ?? threads[0]?.id ?? "";
      const activeThread = threads.find((thread) => thread.id === activeThreadId);
      // Reloading the conversation already open (the thread drawer does)
      // keeps its pending suggestions and their canvas previews.
      const sameConversation =
        diagramId === get().activeDiagramId && activeThreadId === get().activeThreadId;
      setWithPersist({
        threadsByDiagram: {
          ...get().threadsByDiagram,
          [diagramId]: { threads, activeThreadId },
        },
        activeDiagramId: diagramId,
        activeThreadId,
        messages: activeThread?.messages ?? [],
        ...(sameConversation ? {} : { pendingSuggestions: [], pendingPreviews: [] }),
        streamingContent: null,
        queuedMessages: [],
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
      if (threadId !== get().activeThreadId) discardAllPreviews();
      setWithPersist({
        threadsByDiagram: { ...threadsByDiagram, [activeDiagramId]: nextEntry },
        activeThreadId: threadId,
        messages: thread.messages,
        pendingSuggestions: [],
        pendingPreviews: [],
        streamingContent: null,
        queuedMessages: [],
      });
    },

    createThread: (diagramId, firstUserMessage) => {
      if (diagramId === get().activeDiagramId) discardAllPreviews();
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
        streamingContent: null,
        queuedMessages: [],
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
      if (entry.activeThreadId === threadId) discardAllPreviews();
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
          streamingContent: null,
          queuedMessages: [],
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
              streamingContent: null,
              queuedMessages: [],
            }
          : {}),
      });
    },

    initChatThreads: async () => {
      const wasHydrated = isChatThreadsHydrated();
      await hydrateChatThreadsCacheFromIdb();
      // A panel that opened before hydration read an empty cache: reload it.
      const { activeDiagramId, messages, isLoading } = get();
      if (!wasHydrated && activeDiagramId && messages.length === 0 && !isLoading) {
        get().loadHistoryForDiagram(activeDiagramId);
      }
    },

    sendMessage: async (userText, diagramContext, attachments = {}) => {
      const mentions = attachments.mentions ?? [];
      const command = attachments.command;
      const skills = attachments.skills ?? [];
      if (!userText.trim() && mentions.length === 0 && !command) {
        return true;
      }
      // The assistant is busy: hold the message in the composer queue and
      // return so the composer clears the input. Returns false when the queue
      // is full, so the composer can show a toast.
      if (get().isLoading) {
        const queued: QueuedMessage = {
          id: crypto.randomUUID(),
          text: userText.trim(),
          mentions,
          ...(command ? { command } : {}),
          skills: skills ?? [],
        };
        let accepted = true;
        set((state) => {
          if (state.queuedMessages.length >= MAX_QUEUED_MESSAGES) {
            accepted = false;
            return state;
          }
          return { queuedMessages: [...state.queuedMessages, queued] };
        });
        return accepted;
      }
      set({ lastDiagramContext: diagramContext });
      const attached = {
        ...(mentions.length > 0 ? { mentions } : {}),
        ...(command ? { command } : {}),
        ...(skills.length > 0 ? { skills } : {}),
      };
      ensureActiveThread(getVisibleText({ parts: [textPart(userText.trim())], ...attached }));
      const state = get();

      // If hydration hasn't run yet (panel mounted before App shell's
      // useEffect), kick it off so the next call to `loadThreadsForDiagram`
      // hits the cache.
      if (!isChatThreadsHydrated()) {
        void get().initChatThreads();
      }

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [textPart(userText.trim())],
        timestamp: Date.now(),
        ...attached,
      };
      const outgoingMessages = [...state.messages, userMessage];
      await runAssistantTurn(outgoingMessages, diagramContext);
      return true;
    },

    removeQueuedMessage: (id) => {
      set((state) => ({
        queuedMessages: state.queuedMessages.filter((message) => message.id !== id),
      }));
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

    setToolHost: (host) => {
      toolHost = host;
    },

    setDiagramContextSource: (source) => {
      diagramContextSource = source;
    },

    cancelRequest: () => {
      inFlight?.abort();
    },

    acceptSuggestion: async (suggestionId) => {
      // A preview still being drawn finishes first: it is what Accept keeps.
      await previewsInFlight.get(suggestionId);
      const suggestion = get().pendingSuggestions.find(
        (candidateSuggestion) => candidateSuggestion.id === suggestionId,
      );
      if (!suggestion || suggestion.status !== "pending") {
        return;
      }

      if (!toolHost) {
        console.warn("[llm] accept ignored: no diagram host is mounted");
        return;
      }
      const host = toolHost;
      const preview = get().pendingPreviews.find((entry) => entry.suggestionId === suggestionId);

      // Marked first so a second click cannot apply it twice while the
      // layout (if any) runs.
      setSuggestion(suggestionId, { status: "accepted" });
      if (preview && isPreviewApplied(preview, host)) {
        return;
      }
      const { skipped } = await applySuggestion(suggestion.patch.actions, host);
      setSuggestion(suggestionId, { skipped });
    },

    rejectSuggestion: (suggestionId) => {
      const drawing = previewsInFlight.get(suggestionId);
      if (drawing) {
        void drawing.then(() => get().rejectSuggestion(suggestionId));
        return;
      }
      const suggestion = get().pendingSuggestions.find(
        (candidateSuggestion) => candidateSuggestion.id === suggestionId,
      );
      if (!suggestion || suggestion.status !== "pending") {
        return;
      }
      const preview = get().pendingPreviews.find((entry) => entry.suggestionId === suggestionId);
      if (preview) {
        discardPreview(preview);
      }
      setSuggestion(suggestionId, { status: "rejected" });
    },

    clearHistory: () => {
      const { activeDiagramId } = get();
      if (!activeDiagramId) discardAllPreviews();
      if (activeDiagramId) {
        get().createThread(activeDiagramId);
      } else {
        set({
          messages: [],
          pendingSuggestions: [],
          pendingPreviews: [],
          streamingContent: null,
          isLoading: false,
          queuedMessages: [],
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

void useLLMStore.getState().hydrateConnections();

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
