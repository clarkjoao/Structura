// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  LLMProvider,
  LLMMode,
  LLMConfig,
  LLMConnection,
  ChatMessage,
  ConversationThread,
  DiagramThreadState,
  DiagramPatchAction,
  DiagramPatch,
  PendingSuggestion,
  PendingNodePreview,
  ParsedLLMResponse,
  AnalysisResponse,
  AnalysisFinding,
  AnalysisSeverity,
  MentionItem,
  ActiveMention,
  LLMTool,
  LLMToolCall,
} from "./types";

// ─── Store ────────────────────────────────────────────────────────────────────
export { useLLMStore, getPendingNodeIds, getPendingEdgeIds, getSuggestionIdForNode } from "./store";

// ─── Serializers ──────────────────────────────────────────────────────────────
export { serializeDiagramContext } from "./serializer";
export { serializeMentionItem, buildMentionContextBlock } from "./mention-serializer";
export { parseGenerateCommand } from "./ir";
export type { DiagramSerializerOptions } from "./serializer";

// ─── Errors ───────────────────────────────────────────────────────────────────
export { getLLMErrorI18nKey } from "./errors";

// ─── Settings helpers ─────────────────────────────────────────────────────────
// Used internally by LLM components and external consumers.
export { MODEL_PRESETS, getPresetsForProvider } from "./model-presets";
export type { ModelPreset } from "./model-presets";
export type { LLMErrorKind } from "./errors";

// ─── Suggestions ──────────────────────────────────────────────────────────────
// Used internally by LLM components.
export { buildContextualSuggestions } from "./suggestions";
export type { ChatSuggestion } from "./suggestions";

// ─── IR ───────────────────────────────────────────────────────────────────────
// Used internally by LLM components via dynamic import.
export { downloadIR, buildIRFilename } from "./ir";

// ─── Internal sub-modules — import directly: ──────────────────────────────────
//   import { ... } from "@/features/llm/component-catalog";
//   import { ... } from "@/features/llm/prompt-builder";
//   import { ... } from "@/features/llm/patch-parser";
//   import { ... } from "@/features/llm/tools";
//   import { ... } from "@/features/llm/ir";
