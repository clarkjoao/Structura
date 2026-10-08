import type { PluginChatContext } from "./plugin.types";

/**
 * Chat contexts plugins registered (API 1.6, `llm:context`). A leaf module: the lazy LLM chunk
 * imports it directly, without the plugins barrel.
 */
const contexts = new Map<string, PluginChatContext>();
const listeners = new Set<() => void>();
/** Bumped whenever a context is added or removed or says it may answer differently. */
let version = 0;

function notify(): void {
  version += 1;
  for (const listener of [...listeners]) listener();
}

export function registerChatContextContribution(context: PluginChatContext): () => void {
  if (contexts.has(context.id)) {
    throw new Error(`[plugins] A chat context with id "${context.id}" is already registered.`);
  }
  contexts.set(context.id, context);
  let unsubscribe: (() => void) | undefined;
  try {
    unsubscribe = context.subscribe?.(notify);
  } catch (error) {
    console.error(`[plugins] chat context "${context.id}" subscribe threw:`, error);
  }
  notify();
  return () => {
    if (contexts.get(context.id) !== context) return;
    contexts.delete(context.id);
    unsubscribe?.();
    notify();
  };
}

/** For `useSyncExternalStore`: re-read `findChatContext` when the version changes. */
export function subscribeChatContexts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getChatContextsVersion = () => version;

/** The first context that applies to the diagram; one that throws counts as not applying. */
export function findChatContext(diagramId: string): PluginChatContext | null {
  for (const context of contexts.values()) {
    try {
      if (context.appliesTo(diagramId)) return context;
    } catch (error) {
      console.error(`[plugins] chat context "${context.id}" appliesTo threw:`, error);
    }
  }
  return null;
}
