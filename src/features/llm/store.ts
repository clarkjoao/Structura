import { create } from "zustand";
import { useDiagramStore } from "@/features/diagram";
import i18n from "@/infrastructure/i18n";
import { buildSystemPrompt } from "./prompt-builder";
import { parseLLMResponse } from "./patch-parser";
import { LLMProviderError, type LLMErrorKind } from "./errors";
import type {
  AnalysisResponse,
  ChatMessage,
  DiagramPatch,
  LLMConfig,
  PendingNodePreview,
  PendingSuggestion,
} from "./types";
import {
  loadConfigFromLocalStorage,
  saveConfigToLocalStorage,
  loadThreadFromStorage,
  saveThreadToStorage,
} from "./llm-storage";
import {
  applyDiagramPatchAction,
  computeGridPositions,
  resolveRef,
} from "./apply-diagram-patch";
import { sendMessage as sendOpenAIMessage } from "./providers/openai";
import { sendMessage as sendAnthropicMessage } from "./providers/anthropic";
import { sendMessage as sendProxyMessage } from "./providers/proxy";

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
    } catch {
      
    }
    return { ...message, content: "[previous diagram suggestion]" };
  });
}

function ensureHistoryBoundary(): void {
  useDiagramStore.getState().pushHistoryBoundary();
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
  return sendOpenAIMessage(config, messages, systemPrompt, onChunk);
}

interface LLMStoreState {
  config: LLMConfig;
  messages: ChatMessage[];
  pendingSuggestions: PendingSuggestion[];
  pendingPreviews: PendingNodePreview[];
  pendingAnalysis: AnalysisResponse | null;
  streamingContent: string | null;
  isLoading: boolean;
  error: LLMErrorKind | null;
  activeDiagramId: string | null;
  setLLMConfig: (config: LLMConfig) => void;
  sendMessage: (userText: string, diagramContext: string) => Promise<void>;
  acceptSuggestion: (suggestionId: string) => void;
  rejectSuggestion: (suggestionId: string) => void;
  dismissPendingAnalysis: () => void;
  loadHistoryForDiagram: (diagramId: string) => void;
  clearHistory: () => void;
}

export const useLLMStore = create<LLMStoreState>((set, get) => ({
  config: loadConfigFromLocalStorage(),
  messages: [],
  pendingSuggestions: [],
  pendingPreviews: [],
  pendingAnalysis: null,
  streamingContent: null,
  isLoading: false,
  error: null,
  activeDiagramId: null,

  loadHistoryForDiagram: (diagramId) => {
    set({
      activeDiagramId: diagramId,
      messages: loadThreadFromStorage(diagramId),
      pendingSuggestions: [],
      pendingPreviews: [],
      pendingAnalysis: null,
      streamingContent: null,
      error: null,
    });
  },

  setLLMConfig: (config) => {
    saveConfigToLocalStorage(config);
    set({ config });
  },

  sendMessage: async (userText, diagramContext) => {
    if (!userText.trim()) {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: userText.trim(),
      timestamp: Date.now(),
    };
    const state = get();
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
        const currentDiagramIdAfterAnalysis = get().activeDiagramId;
        if (currentDiagramIdAfterAnalysis) {
          saveThreadToStorage(currentDiagramIdAfterAnalysis, get().messages);
        }
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
            payload: { ...action.payload, sourceId: resolvedSourceId, targetId: resolvedTargetId },
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
          const gridPositions = computeGridPositions(
            nodesMissingPosition.length,
            startX,
            startY,
          );
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
      const currentDiagramId = get().activeDiagramId;
      if (currentDiagramId) {
        saveThreadToStorage(currentDiagramId, get().messages);
      }
    } catch (error) {
      const errorKind: LLMErrorKind =
        error instanceof LLMProviderError ? error.kind : "unknown";
      set({
        messages: outgoingMessages,
        streamingContent: null,
        isLoading: false,
        error: errorKind,
      });
      const currentDiagramId = get().activeDiagramId;
      if (currentDiagramId) {
        saveThreadToStorage(currentDiagramId, get().messages);
      }
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
    const diagramId = get().activeDiagramId;
    if (diagramId) {
      saveThreadToStorage(diagramId, []);
    }
    set({
      messages: [],
      pendingSuggestions: [],
      pendingPreviews: [],
      pendingAnalysis: null,
      streamingContent: null,
      error: null,
      isLoading: false,
    });
  },

  dismissPendingAnalysis: () => {
    set({ pendingAnalysis: null });
  },
}));

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
  return pendingPreviews.find((pendingPreview) => pendingPreview.nodeIds.includes(nodeId))
    ?.suggestionId ?? null;
}

