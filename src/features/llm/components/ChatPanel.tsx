import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Download, History, Plus, Settings, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KEY, keyIs } from "@/lib/keyboard-utils";
import { useActiveDiagramModel } from "@/features/diagram";
import {
  buildContextualSuggestions,
  downloadIR,
  getLLMErrorI18nKey,
  useLLMStore,
  type PendingSuggestion,
} from "@/features/llm";
import {
  AnalysisPanel,
  useLLMChat,
  useMentionInput,
  useMentionSearch,
} from "@/features/canvas/chat";
import { ChatMessage } from "./ChatMessage";
import { SuggestionCard } from "./SuggestionCard";
import { LLMSettings } from "./LLMSettings";
import { MentionPicker } from "./MentionPicker";
import { MentionTag } from "./MentionTag";
import { LLMSelector } from "./LLMSelector";
import { MentionInput } from "./MentionInput";
import { ChatSuggestionsEmptyState } from "./ChatSuggestionsEmptyState";
import { ThreadRenameControl } from "./ThreadRenameControl";

interface ChatPanelProps {
  onClose: () => void;
  selectedNodeIds: Set<string>;
  selectedNodeId: string | null;
}

function buildSuggestionByMessageIdMap(
  pendingSuggestions: PendingSuggestion[],
): Map<string, PendingSuggestion> {
  return new Map(
    pendingSuggestions.map((suggestion) => [suggestion.messageId, suggestion] as const),
  );
}

export function ChatPanel({ onClose, selectedNodeIds, selectedNodeId }: ChatPanelProps) {
  const { t } = useTranslation();
  const activeDiagram = useActiveDiagramModel();
  const [showSettings, setShowSettings] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const { search } = useMentionSearch();
  // Exposed so a real generation can become a layout fixture instead of a
  // hand-written reconstruction.
  const lastGeneratedIR = useLLMStore((state) => state.lastGeneratedIR);
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
    createThread,
    threads,
    activeThread,
    switchThread,
    renameThread,
    deleteThread,
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
          <h3 className="truncate text-sm font-semibold">
            {activeThread?.title ?? t("llmChat.title")}
          </h3>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={t("llmChat.threads.historyAria")}
                title={t("llmChat.threads.historyLabel")}
              >
                <History className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" side="bottom" className="w-72 p-1">
              <div className="space-y-1">
                <p className="px-2 py-1 text-[11px] font-medium uppercase text-muted-foreground">
                  {t("llmChat.threads.historyLabel")}
                </p>
                {threads.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    {t("llmChat.threads.empty")}
                  </p>
                ) : (
                  threads.map((thread) => {
                    const isActive = thread.id === activeThread?.id;
                    return (
                      <div
                        key={thread.id}
                        className="flex items-center justify-between rounded-sm px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
                      >
                        <button
                          type="button"
                          onClick={() => switchThread(thread.id)}
                          className="flex min-w-0 flex-1 flex-col items-start text-left"
                        >
                          <span className="truncate font-medium">{thread.title}</span>
                          <span className="truncate text-[10px] text-muted-foreground">
                            {thread.messages.length} msgs
                          </span>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          {isActive ? (
                            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">
                              {t("llmChat.threads.active")}
                            </span>
                          ) : null}
                          <ThreadRenameControl
                            threadId={thread.id}
                            currentTitle={thread.title}
                            onRename={renameThread}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const confirmed = window.confirm(t("llmChat.threads.deleteConfirm"));
                              if (confirmed) {
                                deleteThread(thread.id);
                              }
                            }}
                            className="rounded p-1 text-muted-foreground hover:text-destructive"
                            aria-label={t("llmChat.threads.delete")}
                            title={t("llmChat.threads.delete")}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex items-center gap-1">
          {lastGeneratedIR ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => downloadIR(lastGeneratedIR)}
              aria-label={t("llmChat.ir.export")}
              title={t("llmChat.ir.export")}
            >
              <Download className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              if (activeDiagram) {
                createThread(activeDiagram.id);
              }
            }}
            aria-label={t("llmChat.threads.newThread")}
            title={t("llmChat.threads.newThread")}
            disabled={!activeDiagram}
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
        className="relative min-h-0 min-w-0 flex-1 space-y-2 overflow-x-hidden overflow-y-auto p-3"
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
                  <SuggestionCard suggestion={suggestion} onAccept={accept} onReject={reject} />
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
              <MentionTag key={mention.mentionId} mention={mention} onRemove={removeMention} />
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
              if (isPickerOpen && keyIs(event, KEY.ARROW_DOWN)) {
                event.preventDefault();
                setSelectedIndex((previousIndex) =>
                  Math.min(previousIndex + 1, Math.max(mentionItems.length - 1, 0)),
                );
                return;
              }
              if (isPickerOpen && keyIs(event, KEY.ARROW_UP)) {
                event.preventDefault();
                setSelectedIndex((previousIndex) => Math.max(previousIndex - 1, 0));
                return;
              }
              if (isPickerOpen && keyIs(event, KEY.ENTER)) {
                event.preventDefault();
                handleSelectCurrentMention();
                return;
              }
              if (keyIs(event, KEY.ESCAPE)) {
                dismissPicker();
                return;
              }
              const isSubmit = (event.metaKey || event.ctrlKey) && keyIs(event, KEY.ENTER);
              if (isSubmit && !isPickerOpen) {
                event.preventDefault();
                void handleSend();
              }
            }}
          />
        </div>
        <div className="flex items-center justify-between">
          <LLMSelector onOpenSettings={() => setShowSettings(true)} />
          <div className="flex items-center gap-3">
            <p className="text-[11px] text-muted-foreground">{t("llmChat.submitHint")}</p>
            <Button type="button" onClick={() => void handleSend()} disabled={isLoading}>
              {isLoading ? t("llmChat.sending") : t("llmChat.send")}
            </Button>
          </div>
        </div>
      </div>

      {showSettings ? <LLMSettings onClose={() => setShowSettings(false)} /> : null}
    </div>
  );
}
