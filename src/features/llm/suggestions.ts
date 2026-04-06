export interface ChatSuggestion {
  id: string;
  labelKey: string;
}

export const DEFAULT_SUGGESTIONS: ChatSuggestion[] = [
  { id: "explain", labelKey: "llmChat.suggestions.explain" },
  { id: "components", labelKey: "llmChat.suggestions.components" },
  { id: "failures", labelKey: "llmChat.suggestions.failures" },
  { id: "security", labelKey: "llmChat.suggestions.security" },
  { id: "communicate", labelKey: "llmChat.suggestions.communicate" },
  { id: "improve", labelKey: "llmChat.suggestions.improve" },
];
