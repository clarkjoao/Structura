import type { ComponentPatch, ComponentType, Connection, EdgeStyle } from "@/features/diagram";

export type LLMProvider = "openai" | "anthropic";
export type LLMMode = "direct" | "proxy";

export interface LLMConfig {
  mode: LLMMode;
  provider: LLMProvider;
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ConversationThread {
  diagramId: string;
  messages: ChatMessage[];
  updatedAt: number;
}

export type DiagramPatchAction =
  | {
      type: "ADD_NODE";
      payload: {
        nodeType: ComponentType;
        name: string;
        parentId: string | null;
        position?: { x: number; y: number };
        awsService?: string;
      };
    }
  | { type: "REMOVE_NODE"; payload: { nodeId: string } }
  | { type: "UPDATE_NODE"; payload: { nodeId: string; patch: ComponentPatch } }
  | {
      type: "ADD_EDGE";
      payload: {
        sourceId: string;
        targetId: string;
        label: string;
        edgeStyle?: EdgeStyle;
        patch?: Partial<Omit<Connection, "id" | "sourceId" | "targetId" | "label">>;
      };
    }
  | { type: "REMOVE_EDGE"; payload: { edgeId: string } }
  | { type: "INSERT_PATTERN"; payload: { patternId: string } }
  | { type: "AUTO_LAYOUT"; payload: Record<string, never> }
  | { type: "GET_TAGS"; payload: Record<string, never> };

export interface DiagramPatch {
  id: string;
  description: string;
  actions: DiagramPatchAction[];
  toolCalls?: LLMToolCall[];
}

export interface PendingSuggestion {
  id: string;
  messageId: string;
  patch: DiagramPatch;
  status: "pending" | "accepted" | "rejected";
}

export interface PendingNodePreview {
  suggestionId: string;
  nodeIds: string[];
  edgeIds: string[];
}

export type AnalysisSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface AnalysisFinding {
  severity: AnalysisSeverity;
  category: string;
  title: string;
  detail: string;
  recommendation: string;
  affectedNodes?: string[];
}

export interface AnalysisResponse {
  mode: "analysis";
  summary: string;
  findings: AnalysisFinding[];
  strengths: string[];
  nextSteps: string[];
}

export type ParsedLLMResponse =
  | { kind: "text"; message: string }
  | { kind: "patch"; message: string; patch: DiagramPatch | null }
  | { kind: "analysis"; analysis: AnalysisResponse };

export interface MentionItem {
  id: string;
  kind: "node" | "edge";
  label: string;
  subLabel: string;
  serialized: string;
}

export interface ActiveMention {
  mentionId: string;
  label: string;
}

export interface LLMTool {
  name: string;
  description: string;
  parametersSchema: Record<string, unknown>;
}

export interface LLMToolCall {
  tool: string;
  parameters: Record<string, unknown>;
}
