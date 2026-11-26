// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  LLMProvider,
  LLMMode,
  LLMConnection,
  ConversationThread,
  DiagramPatchAction,
  PendingSuggestion,
  PendingNodePreview,
  AnalysisResponse,
  AnalysisFinding,
  AnalysisSeverity,
  MentionItem,
  ActiveMention,
} from "./types";

// ─── Store ────────────────────────────────────────────────────────────────────
export {
  useLLMStore,
  getPendingNodeIds,
  getPendingRemovedNodeIds,
  getPendingEdgeIds,
  getSuggestionIdForNode,
} from "./store";

// ─── Serializers ──────────────────────────────────────────────────────────────
export { serializeDiagramContext } from "./serializer";
export { buildMentionContextBlock } from "./mention-serializer";

// ─── Errors ───────────────────────────────────────────────────────────────────
export { getLLMErrorI18nKey } from "./errors";

// ─── Settings helpers ─────────────────────────────────────────────────────────
// Used internally by LLM components and external consumers.
export { getPresetsForProvider } from "./model-presets";

// ─── Suggestions ──────────────────────────────────────────────────────────────
// Used internally by LLM components.
export { buildContextualSuggestions } from "./suggestions";

// ─── Internal sub-modules — import directly: ──────────────────────────────────
//   import { ... } from "@/features/llm/component-catalog";
//   import { ... } from "@/features/llm/prompt-builder";
//   import { ... } from "@/features/llm/patch-parser";
//   import { ... } from "@/features/llm/tools";
