import { create } from "zustand";
import { useDiagramStore } from "@/features/diagram";
import { buildSystemPrompt } from "./prompt-builder";
import { parseLLMResponse } from "./patch-parser";
import type {
  ChatMessage,
  DiagramPatch,
  DiagramPatchAction,
  LLMConfig,
  PendingNodePreview,
  PendingSuggestion,
} from "./types";
import { sendMessage as sendOpenAIMessage } from "./providers/openai";
import { sendMessage as sendAnthropicMessage } from "./providers/anthropic";
import { sendMessage as sendProxyMessage } from "./providers/proxy";

const LLM_CONFIG_STORAGE_KEY = "structura:llm:config";

const DEFAULT_LLM_CONFIG: LLMConfig = {
  mode: "proxy",
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
};

function loadConfigFromLocalStorage(): LLMConfig {
  try {
    const rawConfig = localStorage.getItem(LLM_CONFIG_STORAGE_KEY);
    if (!rawConfig) {
      return DEFAULT_LLM_CONFIG;
    }
    const parsedConfig = JSON.parse(rawConfig);
    if (typeof parsedConfig !== "object" || parsedConfig === null) {
      return DEFAULT_LLM_CONFIG;
    }
    return {
      mode: parsedConfig.mode === "direct" ? "direct" : "proxy",
      provider: parsedConfig.provider === "anthropic" ? "anthropic" : "openai",
      apiKey: typeof parsedConfig.apiKey === "string" ? parsedConfig.apiKey : "",
      model:
        typeof parsedConfig.model === "string" && parsedConfig.model.length > 0
          ? parsedConfig.model
          : DEFAULT_LLM_CONFIG.model,
    };
  } catch {
    return DEFAULT_LLM_CONFIG;
  }
}

function saveConfigToLocalStorage(config: LLMConfig): void {
  localStorage.setItem(LLM_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

interface AppliedPatchResult {
  addedNodeId: string | null;
  addedEdgeId: string | null;
}

function applyDiagramPatchAction(action: DiagramPatchAction): AppliedPatchResult {
  const diagramState = useDiagramStore.getState();

  switch (action.type) {
    case "ADD_NODE":
      return {
        addedNodeId: diagramState.addComponent(
        action.payload.nodeType,
        action.payload.name,
        action.payload.parentId,
        action.payload.position,
      ).id,
        addedEdgeId: null,
      };
    case "REMOVE_NODE":
      diagramState.removeComponent(action.payload.nodeId);
      return { addedNodeId: null, addedEdgeId: null };
    case "UPDATE_NODE":
      diagramState.updateComponent(action.payload.nodeId, action.payload.patch);
      return { addedNodeId: null, addedEdgeId: null };
    case "ADD_EDGE": {
      const connection = diagramState.addConnection(
        action.payload.sourceId,
        action.payload.targetId,
        action.payload.label,
        action.payload.edgeStyle,
      );
      if (action.payload.patch) {
        diagramState.updateConnection(connection.id, action.payload.patch);
      }
      return { addedNodeId: null, addedEdgeId: connection.id };
    }
    case "REMOVE_EDGE":
      diagramState.removeConnection(action.payload.edgeId);
      return { addedNodeId: null, addedEdgeId: null };
    default:
      return { addedNodeId: null, addedEdgeId: null };
  }
}

function ensureHistoryBoundary(): void {
  const diagramState = useDiagramStore.getState();
  const activeDiagramId = diagramState.activeDiagramId;
  if (!activeDiagramId) {
    return;
  }
  const activeDiagram = diagramState.diagrams[activeDiagramId];
  if (!activeDiagram) {
    return;
  }

  const firstConnection = Object.values(activeDiagram.snapshot.connections)[0];
  if (firstConnection) {
    diagramState.updateConnection(firstConnection.id, {});
    return;
  }

  const firstComponent = Object.values(activeDiagram.snapshot.components)[0];
  if (firstComponent) {
    diagramState.updateComponent(firstComponent.id, {});
  }
}

async function executeLLMMessage(
  config: LLMConfig,
  messages: ChatMessage[],
  systemPrompt: string,
): Promise<string> {
  if (config.mode === "proxy") {
    return sendProxyMessage(config, messages, systemPrompt);
  }
  if (config.provider === "anthropic") {
    return sendAnthropicMessage(config, messages, systemPrompt);
  }
  return sendOpenAIMessage(config, messages, systemPrompt);
}

interface LLMStoreState {
  config: LLMConfig;
  messages: ChatMessage[];
  pendingSuggestions: PendingSuggestion[];
  pendingPreviews: PendingNodePreview[];
  isLoading: boolean;
  error: string | null;
  setLLMConfig: (config: LLMConfig) => void;
  sendMessage: (userText: string, diagramContext: string) => Promise<void>;
  acceptSuggestion: (suggestionId: string) => void;
  rejectSuggestion: (suggestionId: string) => void;
  clearHistory: () => void;
}

export const useLLMStore = create<LLMStoreState>((set, get) => ({
  config: loadConfigFromLocalStorage(),
  messages: [],
  pendingSuggestions: [],
  pendingPreviews: [],
  isLoading: false,
  error: null,

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
    set({
      messages: outgoingMessages,
      isLoading: true,
      error: null,
    });

    try {
      const systemPrompt = buildSystemPrompt(diagramContext);
      const rawAssistantResponse = await executeLLMMessage(
        state.config,
        outgoingMessages,
        systemPrompt,
      );
      const parsedResponse = parseLLMResponse(rawAssistantResponse);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: parsedResponse.message,
        timestamp: Date.now(),
      };

      const nextSuggestions = [...get().pendingSuggestions];
      const nextPreviews = [...get().pendingPreviews];
      if (parsedResponse.patch) {
        const suggestion: PendingSuggestion = {
          id: crypto.randomUUID(),
          messageId: assistantMessage.id,
          patch: parsedResponse.patch,
          status: "pending",
        };
        nextSuggestions.push(suggestion);

        const previewNodeIds: string[] = [];
        const previewEdgeIds: string[] = [];
        for (const action of parsedResponse.patch.actions) {
          if (action.type !== "ADD_NODE" && action.type !== "ADD_EDGE") {
            continue;
          }
          const applied = applyDiagramPatchAction(action);
          if (applied.addedNodeId) {
            previewNodeIds.push(applied.addedNodeId);
          }
          if (applied.addedEdgeId) {
            previewEdgeIds.push(applied.addedEdgeId);
          }
        }
        nextPreviews.push({
          suggestionId: suggestion.id,
          nodeIds: previewNodeIds,
          edgeIds: previewEdgeIds,
        });
      }

      set({
        messages: [...outgoingMessages, assistantMessage],
        pendingSuggestions: nextSuggestions,
        pendingPreviews: nextPreviews,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : "Unknown LLM error",
      });
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
    set((state) => ({
      messages: [],
      pendingSuggestions: [],
      pendingPreviews: [],
      error: null,
      isLoading: false,
      config: state.config,
    }));
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
        return action.type;
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

