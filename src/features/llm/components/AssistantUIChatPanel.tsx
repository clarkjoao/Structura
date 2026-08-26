"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  Download,
  History,
  MessageSquarePlus,
  Plus,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLLMStore } from "@/features/llm";
import { useLLMChat } from "@/features/canvas/chat";
import {
  AssistantRuntimeProvider,
  ThreadPrimitive,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { useAssistantUIAdapter } from "@/features/llm/adapters/useAssistantUIAdapter";
import { AssistantUIComposer } from "./AssistantUIComposer";
import { ThreadDrawer } from "./ThreadDrawer";
import { LLMSelector } from "./LLMSelector";
import { LLMSettings } from "./LLMSettings";
import { AnalysisPanel } from "@/features/canvas/chat";
import { buildContextualSuggestions, downloadIR, getLLMErrorI18nKey } from "@/features/llm";
import type { ChatSuggestion } from "@/features/llm/suggestions";
import { useActiveDiagramModel } from "@/features/diagram";
import {
  UserMessageComponent,
  AssistantMessageComponent,
} from "./AssistantUIMessage";
import { SuggestionCard } from "./SuggestionCard";

interface AssistantUIChatPanelProps {
  onClose: () => void;
  selectedNodeIds?: Set<string>;
  selectedNodeId?: string | null;
}

export function AssistantUIChatPanel({
  onClose,
  selectedNodeIds = new Set(),
  selectedNodeId = null,
}: AssistantUIChatPanelProps) {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [showThreadDrawer, setShowThreadDrawer] = useState(false);

  const activeDiagram = useActiveDiagramModel();
  const lastGeneratedIR = useLLMStore((s) => s.lastGeneratedIR);

  const adapter = useAssistantUIAdapter();
  const runtime = useExternalStoreRuntime(adapter);

  const {
    messages,
    send,
    isLoading,
    pendingSuggestions,
    pendingAnalysis,
    dismissPendingAnalysis,
    error,
    activeThread,
    createThread,
    accept,
    reject,
  } = useLLMChat({ selectedNodeIds, selectedNodeId });

  // Empty state is rendered *without* creating a thread — no auto-persistence.
  const hasMessages = messages.length > 0;

  const contextualSuggestions = useMemo(
    () => buildContextualSuggestions(activeDiagram ?? null),
    [activeDiagram],
  );
  const diagramName = activeDiagram?.name ?? "";

  const handleSend = useCallback(
    async (text: string, mentions: Parameters<typeof send>[1]) => {
      await send(text, mentions);
    },
    [send],
  );

  const handleCreateThread = useCallback(() => {
    if (activeDiagram) {
      createThread(activeDiagram.id);
    }
  }, [activeDiagram, createThread]);

  const threadedTitle =
    activeThread?.title && activeThread.title.length > 0
      ? activeThread.title
      : t("llmChat.title");

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex h-full w-[26rem] max-w-[92vw] flex-col overflow-hidden rounded-l-xl border-l border-border bg-card shadow-2xl">
        {/* Header */}
        <ChatHeader
          title={threadedTitle}
          diagramName={diagramName}
          hasExportableIR={Boolean(lastGeneratedIR)}
          onOpenThreads={() => setShowThreadDrawer(true)}
          onCreateThread={handleCreateThread}
          onExportIR={() => {
            if (lastGeneratedIR) downloadIR(lastGeneratedIR);
          }}
          onOpenSettings={() => setShowSettings(true)}
          onClose={onClose}
        />

        {/* Thread drawer */}
        <ThreadDrawer open={showThreadDrawer} onClose={() => setShowThreadDrawer(false)} />

        {/* Messages — fixed-height scroll container */}
        {/* min-h-0 + flex-1 are required so the scrollable viewport actually
            constrains its height instead of letting flex children grow
            indefinitely (which was the previous bug). */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <ThreadPrimitive.Root className="flex h-full flex-col">
            <ThreadPrimitive.Viewport className="h-full w-full overflow-y-auto">
              <div className="flex flex-col gap-3 p-4">
                {pendingAnalysis ? (
                  <AnalysisPanel
                    analysis={pendingAnalysis}
                    onDismiss={dismissPendingAnalysis}
                  />
                ) : null}

                {hasMessages ? (
                  <ThreadPrimitive.Messages>
                    {({ message }) => {
                      if (message.role === "user") {
                        return <UserMessageComponent />;
                      }
                      return <AssistantMessageComponent />;
                    }}
                  </ThreadPrimitive.Messages>
                ) : (
                  <EmptyState
                    diagramName={diagramName}
                    suggestions={contextualSuggestions}
                    onSelectSuggestion={(text) => {
                      void send(text, []);
                    }}
                  />
                )}

                {messages.map((message) => {
                  const suggestion = pendingSuggestions.find(
                    (s) => s.messageId === message.id && s.status === "pending",
                  );
                  if (!suggestion) return null;
                  return (
                    <div key={`suggestion-${message.id}`} className="mt-1">
                      <SuggestionCard
                        suggestion={suggestion}
                        onAccept={accept}
                        onReject={reject}
                      />
                    </div>
                  );
                })}
              </div>
            </ThreadPrimitive.Viewport>

            <ScrollToBottomAffordance />
          </ThreadPrimitive.Root>
        </div>

        {/* Error */}
        {error ? (
          <div className="mx-3 mb-2 space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-xs font-medium text-destructive">
              {t(getLLMErrorI18nKey(error))}
            </p>
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

        {/* Composer */}
        <div className="shrink-0 border-t border-border bg-card/60 p-3">
          <AssistantUIComposer onSend={handleSend} isLoading={isLoading} />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              {t("llmChat.disclaimer", {
                defaultValue: "AI can make mistakes. Verify important changes.",
              })}
            </p>
            <LLMSelector onOpenSettings={() => setShowSettings(true)} />
          </div>
        </div>

        {/* Settings */}
        {showSettings ? <LLMSettings onClose={() => setShowSettings(false)} /> : null}
      </div>
    </AssistantRuntimeProvider>
  );
}

/* --- Sub-components --- */

interface ChatHeaderProps {
  title: string;
  diagramName: string;
  hasExportableIR: boolean;
  onOpenThreads: () => void;
  onCreateThread: () => void;
  onExportIR: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

function ChatHeader({
  title,
  diagramName,
  hasExportableIR,
  onOpenThreads,
  onCreateThread,
  onExportIR,
  onOpenSettings,
  onClose,
}: ChatHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-start justify-between gap-2 border-b border-border bg-card px-4 py-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/15">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold tracking-tight">
            <span className="truncate">{title}</span>
          </h3>
          <p className="truncate text-[11px] text-muted-foreground">
            {t("llmChat.headerSubtitle", {
              defaultValue: "Diagram assistant",
              name: diagramName,
            })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        <IconButton
          label={t("llmChat.threads.historyAria")}
          onClick={onOpenThreads}
        >
          <History className="h-4 w-4" />
        </IconButton>
        {hasExportableIR && (
          <IconButton label={t("llmChat.ir.export")} onClick={onExportIR}>
            <Download className="h-4 w-4" />
          </IconButton>
        )}
        <IconButton
          label={t("llmChat.threads.newThread")}
          onClick={onCreateThread}
        >
          <MessageSquarePlus className="h-4 w-4" />
        </IconButton>
        <IconButton label={t("llmChat.openSettings")} onClick={onOpenSettings}>
          <Settings className="h-4 w-4" />
        </IconButton>
        <IconButton label={t("llmChat.close")} onClick={onClose}>
          <X className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

interface IconButtonProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}

function IconButton({ label, onClick, children }: IconButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="h-7 w-7"
    >
      {children}
    </Button>
  );
}

interface EmptyStateProps {
  diagramName: string;
  suggestions: ChatSuggestion[];
  onSelectSuggestion: (text: string) => void;
}

function EmptyState({ diagramName, suggestions, onSelectSuggestion }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-primary/5 text-primary ring-1 ring-primary/20">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-foreground">{t("llmChat.title")}</h4>
        <p className="text-xs text-muted-foreground">
          {t("llmChat.emptySubtitle", {
            defaultValue: "How can I help you shape this diagram?",
            name: diagramName,
          })}
        </p>
      </div>
      <div className="w-full space-y-1.5">
        {suggestions.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelectSuggestion(t(s.labelKey))}
            className="group flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-left text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
            <span className="truncate">{t(s.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ScrollToBottomAffordance() {
  const { t } = useTranslation();
  const [atBottom, setAtBottom] = useState(true);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Track scroll position to decide whether to render the affordance.
  useEffect(() => {
    const onScroll = () => {
      const root = viewportRef.current?.closest('[data-aui-thread-viewport]');
      // Fallback: any scrollable element near us.
      const scrollable =
        (root as HTMLElement | null) ??
        (viewportRef.current?.parentElement?.querySelector(
          '[class*="overflow"]',
        ) as HTMLElement | null);
      if (!scrollable) return;
      const distance =
        scrollable.scrollHeight - scrollable.scrollTop - scrollable.clientHeight;
      setAtBottom(distance < 40);
    };
    const target = viewportRef.current?.parentElement;
    target?.addEventListener("scroll", onScroll, { passive: true });
    return () => target?.removeEventListener("scroll", onScroll);
  }, []);

  if (atBottom) return null;
  return (
    <div className="pointer-events-none sticky bottom-3 z-10 flex w-full justify-center">
      <button
        type="button"
        onClick={() => {
          const root = viewportRef.current?.closest(
            '[data-aui-thread-viewport]',
          ) as HTMLElement | null;
          const scrollable =
            root ??
            (viewportRef.current?.parentElement?.querySelector(
              '[class*="overflow"]',
            ) as HTMLElement | null);
          if (scrollable) {
            scrollable.scrollTo({
              top: scrollable.scrollHeight,
              behavior: "smooth",
            });
          }
        }}
        className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-foreground shadow-md transition-colors hover:bg-surface-hover"
      >
        <ChevronDown className="h-3 w-3" />
        {t("llmChat.scrollToBottom")}
      </button>
    </div>
  );
}
