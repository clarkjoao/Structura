import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { CommandActionContext } from "../commands/registry";
import { conversationToMarkdown } from "../message-markdown";
import { useLLMStore } from "../store";

/** What the action commands (/clear, /new, /clean, /copy) do in this chat. */
export function useCommandActions(): CommandActionContext {
  const { t } = useTranslation();
  return useMemo<CommandActionContext>(
    () => ({
      newConversation: () => {
        if (!window.confirm(t("llmChat.slash.clearConfirm"))) return;
        const { activeDiagramId, createThread, clearHistory } = useLLMStore.getState();
        if (activeDiagramId) {
          createThread(activeDiagramId);
          toast(t("llmChat.slash.newChat"));
        } else {
          clearHistory();
          toast(t("llmChat.slash.cleared"));
        }
      },
      copyConversation: async () => {
        const { messages, pendingSuggestions } = useLLMStore.getState();
        if (messages.length === 0) {
          toast(t("llmChat.slash.noMessages"));
          return;
        }
        const markdown = conversationToMarkdown(messages, {
          t,
          findSuggestion: (id) => pendingSuggestions.find((suggestion) => suggestion.id === id),
        });
        try {
          await navigator.clipboard.writeText(markdown);
          toast(t("llmChat.slash.copied"));
        } catch {
          toast(t("llmChat.slash.copyFailed"));
        }
      },
    }),
    [t],
  );
}
