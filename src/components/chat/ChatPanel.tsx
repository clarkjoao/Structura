import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendingSuggestion } from "@/features/llm";
import { useLLMChat, useMentionInput, useMentionSearch } from "@/features/canvas/chat";
import { ChatMessage } from "./ChatMessage";
import { SuggestionCard } from "./SuggestionCard";
import { LLMSettings } from "./LLMSettings";
import { MentionPicker } from "./MentionPicker";
import { MentionTag } from "./MentionTag";
import { LLMSelector } from "./LLMSelector";
import { MentionInput } from "./MentionInput";

interface ChatPanelProps {
  onClose: () => void;
}

function buildSuggestionByMessageIdMap(pendingSuggestions: PendingSuggestion[]): Map<string, PendingSuggestion> {
  return new Map(
    pendingSuggestions.map((suggestion) => [suggestion.messageId, suggestion] as const),
  );
}

export function ChatPanel({ onClose }: ChatPanelProps) {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { search } = useMentionSearch();
  const {
    segments,
    setSegments,
    syncToken,
    setInputText,
    isPickerOpen,
    mentionQuery,
    activeMentions,
    selectMention,
    removeMention,
    dismissPicker,
    resolvedText,
    clearMentions,
  } = useMentionInput();
  const {
    messages,
    send,
    isLoading,
    pendingSuggestions,
    accept,
    reject,
    config,
    setConfig,
  } = useLLMChat();
  const mentionItems = useMemo(
    () => (isPickerOpen ? search(mentionQuery) : []),
    [isPickerOpen, mentionQuery, search],
  );

  const suggestionByMessageId = useMemo(
    () => buildSuggestionByMessageIdMap(pendingSuggestions),
    [pendingSuggestions],
  );

  const handleSend = async () => {
    if (!resolvedText.trim()) {
      return;
    }
    await send(resolvedText, activeMentions);
    setSegments([{ kind: "text", value: "" }]);
    clearMentions();
    setInputText("");
    dismissPicker();
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [mentionQuery, isPickerOpen]);

  const handleSelectCurrentMention = () => {
    const selectedItem = mentionItems[selectedIndex];
    if (!selectedItem) {
      return;
    }
    selectMention(selectedItem);
    setSelectedIndex(0);
  };

  return (
    <div className="w-96 h-full border-l border-border bg-card flex flex-col relative">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-sm font-semibold truncate">{t("llmChat.title")}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setShowSettings(true)}
            aria-label={t("llmChat.openSettings")}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            aria-label={t("llmChat.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("llmChat.emptyState")}</p>
        ) : (
          messages.map((message) => {
            const suggestion = suggestionByMessageId.get(message.id);
            return (
              <div key={message.id} className="space-y-2">
                <ChatMessage message={message} />
                {suggestion ? (
                  <SuggestionCard
                    suggestion={suggestion}
                    onAccept={accept}
                    onReject={reject}
                  />
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border p-3 space-y-2 relative">
        {activeMentions.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {activeMentions.map((mention) => (
              <MentionTag
                key={mention.mentionId}
                mention={mention}
                onRemove={removeMention}
              />
            ))}
          </div>
        ) : null}
        <div className="relative">
          {isPickerOpen ? (
            <MentionPicker
              items={mentionItems}
              selectedIndex={selectedIndex}
              onSelect={selectMention}
              onDismiss={dismissPicker}
            />
          ) : null}
          <MentionInput
            segments={segments}
            syncToken={syncToken}
            onSegmentsChange={setSegments}
            placeholder={t("llmChat.inputPlaceholder")}
            disabled={isLoading}
            onKeyDown={(event) => {
              if (isPickerOpen && event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((previousIndex) =>
                  Math.min(previousIndex + 1, Math.max(mentionItems.length - 1, 0)),
                );
                return;
              }
              if (isPickerOpen && event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((previousIndex) => Math.max(previousIndex - 1, 0));
                return;
              }
              if (isPickerOpen && event.key === "Enter") {
                event.preventDefault();
                handleSelectCurrentMention();
                return;
              }
              if (event.key === "Escape") {
                dismissPicker();
                return;
              }
              const isSubmit = (event.metaKey || event.ctrlKey) && event.key === "Enter";
              if (isSubmit && !isPickerOpen) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <LLMSelector config={config} onChange={setConfig} />
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-muted-foreground">
              {t("llmChat.submitHint")}
            </p>
            <Button type="button" onClick={() => void handleSend()} disabled={isLoading}>
              {isLoading ? t("llmChat.sending") : t("llmChat.send")}
            </Button>
          </div>
        </div>
      </div>

      {showSettings ? (
        <LLMSettings
          config={config}
          onClose={() => setShowSettings(false)}
          onSave={setConfig}
        />
      ) : null}
    </div>
  );
}

