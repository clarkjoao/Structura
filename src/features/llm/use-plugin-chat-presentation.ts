import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  findChatContext,
  getChatContextsVersion,
  subscribeChatContexts,
} from "@/features/plugins/chat-context-registry";
import type { PluginChatPresentation } from "@/features/plugins/plugin.types";

/**
 * How the chat presents itself on `diagramId` when a plugin's chat context owns it (API 1.8):
 * its title and suggestions, or null for the built-in assistant. Follows the context as it
 * starts or stops applying (e.g. a folder opened in a plugin pane).
 */
export function usePluginChatPresentation(diagramId: string | null): PluginChatPresentation | null {
  const version = useSyncExternalStore(subscribeChatContexts, getChatContextsVersion);
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "en").startsWith("pt") ? "pt-BR" : "en";
  return useMemo(() => {
    void version; // re-evaluated on every registry change
    if (!diagramId) return null;
    const context = findChatContext(diagramId);
    if (!context?.presentation) return null;
    try {
      const presentation = context.presentation({ diagramId, locale });
      return typeof presentation?.title === "string" ? presentation : null;
    } catch (error) {
      console.error(`[llm] chat context "${context.id}" presentation threw:`, error);
      return null;
    }
  }, [diagramId, locale, version]);
}
