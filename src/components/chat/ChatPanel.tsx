import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useActiveDiagramModel } from "@/features/diagram";
import { buildContextualSuggestions, getLLMErrorI18nKey, type PendingSuggestion } from "@/features/llm";
import { AnalysisPanel, useLLMChat, useMentionInput, useMentionSearch } from "@/features/canvas/chat";
import { ChatMessage } from "./ChatMessage";
import { SuggestionCard } from "./SuggestionCard";
import { LLMSettings } from "./LLMSettings";
import { MentionPicker } from "./MentionPicker";
import { MentionTag } from "./MentionTag";
import { LLMSelector } from "./LLMSelector";
import { MentionInput } from "./MentionInput";
import { ChatSuggestionsEmptyState } from "./ChatSuggestionsEmptyState";

interface ChatPanelProps {
  onClose: () => void;
  selectedNodeIds: Set<string>;
  selectedNodeId: string | null;
}

function buildSuggestionByMessageIdMap(pendingSuggestions: PendingSuggestion[]): Map<string, PendingSuggestion> {
  return new Map(
    pendingSuggestions.map((suggestion) => [suggestion.messageId, suggestion] as const),
  );
}

export function ChatPanel({
  onClose,
  selectedNodeIds,
  selectedNodeId,
}: ChatPanelProps) {
  const { t } = useTranslation();
  const activeDiagram = useActiveDiagramModel();
  const [showSettings, setShowSettings] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
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
    pendingAnalysis,
    dismissPendingAnalysis,
    streamingContent,
    error,
    config,
    setConfig,
    clearHistory,
  } = useLLMChat({ selectedNodeIds, selectedNodeId });

  const contextualSuggestions = useMemo(
    () => buildContextualSuggestions(activeDiagram ?? null),
    [activeDiagram],
  );
  const mentionItems = useMemo(
    () => (isPickerOpen ? search(mentionQuery) : []),
    [isPickerOpen, mentionQuery, search],
  );
  const diagramName = activeDiagram?.name ?? "";

  const suggestionByMessageId = useMemo(
    () => buildSuggestionByMessageIdMap(pendingSuggestions),
    [pendingSuggestions],
  );
  const lastAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.role === "assistant") {
        return message.id;
      }
    }
    return null;
  }, [messages]);

  const handleScroll = useCallback(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setShowScrollButton(distanceFromBottom > 80);
  }, []);

  useEffect(() => {
    const element = scrollContainerRef.current;
    if (!element) {
      return;
    }
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 80) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    } else if (messages.length > 0) {
      setShowScrollButton(true);
    }
  }, [messages.length, streamingContent]);

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
    <div className="relative flex h-full w-96 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate text-sm font-semibold">{t("llmChat.title")}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={clearHistory}
            aria-label={t("llmChat.newThread")}
            title={t("llmChat.newThread")}
          >
            <Plus className="h-4 w-4" />
          </Button>
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

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 space-y-2 overflow-y-auto p-3"
      >
        {pendingAnalysis ? (
          <AnalysisPanel analysis={pendingAnalysis} onDismiss={dismissPendingAnalysis} />
        ) : null}
        {messages.length === 0 ? (
          <ChatSuggestionsEmptyState
            diagramName={diagramName}
            suggestions={contextualSuggestions}
            onSelectSuggestion={(text) => {
              void send(text, []);
            }}
          />
        ) : (
          messages.map((message) => {
            const suggestion = suggestionByMessageId.get(message.id);
            const isStreamingMessage =
              streamingContent !== null &&
              message.role === "assistant" &&
              message.id === lastAssistantMessageId;
            return (
              <div key={message.id} className="space-y-2">
                <ChatMessage message={message} isStreaming={isStreamingMessage} />
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
        <div ref={messagesEndRef} />

        {showScrollButton ? (
          <button
            type="button"
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
              setShowScrollButton(false);
            }}
            className="sticky bottom-2 left-1/2 flex w-fit -translate-x-1/2 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] text-primary-foreground shadow-md"
          >
            <ChevronDown className="h-3 w-3" />
            {t("llmChat.scrollToBottom")}
          </button>
        ) : null}
      </div>
      {error ? (
        <div className="mx-3 mb-2 space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-xs font-medium text-destructive">{t(getLLMErrorI18nKey(error))}</p>
          {error === "auth" || error === "cors" || error === "model" ? (
            <button
              type="button"
              className="text-xs text-primary underline"
              onClick={() => setShowSettings(true)}
            >
              {t("llmChat.error.action.settings")}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="relative space-y-2 border-t border-border p-3">
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
