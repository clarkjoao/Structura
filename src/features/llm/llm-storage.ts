import type { ChatMessage, ConversationThread, LLMConfig } from "./types";

const LLM_CONFIG_STORAGE_KEY = "structura:llm:config";
const CHAT_HISTORY_KEY = "structura:llm:history";
const MAX_THREADS = 20;
const MAX_MESSAGES_PER_THREAD = 50;

const DEFAULT_LLM_CONFIG: LLMConfig = {
  mode: "proxy",
  provider: "openai",
  apiKey: "",
  model: "gpt-4o-mini",
};

export function loadThreadFromStorage(diagramId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    if (!raw) {
      return [];
    }
    const threads = JSON.parse(raw) as Record<string, ConversationThread>;
    return threads[diagramId]?.messages ?? [];
  } catch {
    return [];
  }
}

export function saveThreadToStorage(diagramId: string, messages: ChatMessage[]): void {
  try {
    const raw = localStorage.getItem(CHAT_HISTORY_KEY);
    const threads: Record<string, ConversationThread> = raw ? JSON.parse(raw) : {};
    threads[diagramId] = {
      diagramId,
      messages: messages.slice(-MAX_MESSAGES_PER_THREAD),
      updatedAt: Date.now(),
    };
    const trimmed = Object.entries(threads)
      .sort(([, threadA], [, threadB]) => threadB.updatedAt - threadA.updatedAt)
      .slice(0, MAX_THREADS);
    localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(Object.fromEntries(trimmed)));
  } catch {

  }
}

export function loadConfigFromLocalStorage(): LLMConfig {
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

export function saveConfigToLocalStorage(config: LLMConfig): void {
  localStorage.setItem(LLM_CONFIG_STORAGE_KEY, JSON.stringify(config));
}
