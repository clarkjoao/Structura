import type { PluginChatContext } from "./plugin.types";

/**
 * Chat contexts plugins registered (API 1.6, `llm:context`). A leaf module: the lazy LLM chunk
 * imports it directly, without the plugins barrel.
 */
const contexts = new Map<string, PluginChatContext>();

export function registerChatContextContribution(context: PluginChatContext): () => void {
  if (contexts.has(context.id)) {
    throw new Error(`[plugins] A chat context with id "${context.id}" is already registered.`);
  }
  contexts.set(context.id, context);
  return () => {
    if (contexts.get(context.id) === context) contexts.delete(context.id);
  };
}

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
