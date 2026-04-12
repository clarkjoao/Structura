export type {
  LLMProvider,
  LLMMode,
  LLMConfig,
  ChatMessage,
  ConversationThread,
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

export { serializeDiagramContext } from "./serializer";
export type { DiagramSerializerOptions } from "./serializer";
export { buildSystemPrompt, buildResponseLanguageInstruction } from "./prompt-builder";
export { parseLLMResponse } from "./patch-parser";
export { serializeMentionItem, buildMentionContextBlock } from "./mention-serializer";
export type { ModelPreset } from "./model-presets";
export { MODEL_PRESETS } from "./model-presets";
export type { ChatSuggestion } from "./suggestions";
export { buildContextualSuggestions } from "./suggestions";
export type { LLMErrorKind } from "./errors";
export { LLMProviderError, getLLMErrorI18nKey } from "./errors";
export { ALL_TOOLS, WRITE_TOOL_NAMES, isWriteTool } from "./tools";
export {
  isValidNodeType,
  ALL_COMPONENT_TYPES,
  buildComponentTypeCatalog,
  STRUCTURAL_TYPES,
  C4_TYPES,
  AWS_TYPES,
} from "./component-catalog";
export type { ComponentTypeDefinition } from "./component-catalog";
export {
  useLLMStore,
  getPendingNodeIds,
  getPendingEdgeIds,
  getSuggestionIdForNode,
} from "./store";

