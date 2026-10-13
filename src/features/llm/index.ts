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
  MentionItem,
} from "./types";

// ─── Store ────────────────────────────────────────────────────────────────────
export { useLLMStore, countConversationMessages } from "./store";

// ─── Serializers ──────────────────────────────────────────────────────────────
export { serializeDiagramContext } from "./serializer";
export type { DiagramSerializerOptions } from "./serializer";

// ─── Errors ───────────────────────────────────────────────────────────────────
export { getLLMErrorI18nKey } from "./errors";

// ─── Settings helpers ─────────────────────────────────────────────────────────
// Used internally by LLM components and external consumers.
export { MODEL_PRESETS, getPresetsForProvider } from "./model-presets";
export type { ModelPreset } from "./model-presets";
export type { LLMError, LLMErrorKind } from "./errors";

// ─── Suggestions ──────────────────────────────────────────────────────────────
// Used internally by LLM components.
export { buildContextualSuggestions } from "./suggestions";
export type { ChatSuggestion } from "./suggestions";

// ─── Internal sub-modules — import directly: ──────────────────────────────────
//   import { ... } from "@/features/llm/component-catalog";
//   import { ... } from "@/features/llm/prompt-builder";
//   import { ... } from "@/features/llm/patch-parser";
//   import { ... } from "@/features/llm/tools";
