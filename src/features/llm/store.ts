import { create } from "zustand";
import { useDiagramStore } from "@/features/diagram";
import { pushHistory } from "@/features/diagram/store/slices/history.slice";
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
      const parsed = JSON.parse(trimmed) as unknown;
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "message" in parsed &&
        typeof (parsed as { message?: unknown }).message === "string"
      ) {
        return { ...message, content: (parsed as { message: string }).message };
      }
    } catch {
      // keep original
    }
    return message;
  });
}

function resolveRef(value: string, nameToIdMap: Map<string, string>): string {
  const match = value.match(/^@ref:(.+)$/i);
  if (!match) {
    return value;
  }
  return nameToIdMap.get(match[1].toLowerCase()) ?? value;
}

function computeGridPositions(
  count: number,
  startX = 200,
  startY = 200,
): Array<{ x: number; y: number }> {
  const COL_GAP = 320;
  const ROW_GAP = 160;
  const COLS = 3;
  return Array.from({ length: count }, (_, index) => ({
    x: startX + (index % COLS) * COL_GAP,
    y: startY + Math.floor(index / COLS) * ROW_GAP,
  }));
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
          action.payload.awsService,
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
  useDiagramStore.setState((state) => {
    pushHistory(state);
  });
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
      const sanitizedMessages = sanitizeMessagesForLLM(outgoingMessages);
      const rawAssistantResponse = await executeLLMMessage(
        state.config,
        sanitizedMessages,
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

