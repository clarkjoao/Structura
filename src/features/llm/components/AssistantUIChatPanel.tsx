"use client";

import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, History, MessageSquarePlus, Settings, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLLMChat } from "@/features/llm/hooks/useLLMChat";
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
import { isUsableConnection } from "@/features/llm/llm-storage";
import { commandRegistry } from "@/features/llm/commands/builtins";
import type { PromptCommand } from "@/features/llm/commands/registry";
import { ChatActionsContext, type ChatActions } from "./chat-actions";
import { useActiveDiagramModel } from "@/features/diagram";
import { useResolvedDiagram } from "@/features/llm/hooks/useResolvedDiagram";
import { UserMessageComponent, AssistantMessageComponent } from "./AssistantUIMessage";
import { TypingIndicator } from "./TypingIndicator";

interface AssistantUIChatPanelProps {
  onClose: () => void;
  selectedNodeIds?: Set<string>;
  selectedNodeId?: string | null;
}

/* ── Skeleton card ──────────────────────────────────────────────────────── */
function SkeletonMessage({ role }: { role: "user" | "assistant" }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`rounded-2xl px-4 py-2.5 ${isUser ? "bg-muted" : "bg-muted/60"} space-y-1.5`}
        style={{ maxWidth: "75%" }}
      >
        <div className="h-3 w-32 animate-pulse rounded-md bg-muted-foreground/20" />
        <div className="h-3 w-24 animate-pulse rounded-md bg-muted-foreground/15" />
      </div>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="space-y-3">
      <SkeletonMessage role="user" />
      <SkeletonMessage role="assistant" />
      <SkeletonMessage role="assistant" />
      <SkeletonMessage role="user" />
    </div>
  );
}
/* ───────────────────────────────────────────────────────────────────────── */

export const AssistantUIChatPanel = memo(function AssistantUIChatPanel({
  onClose,
  selectedNodeIds = new Set(),
  selectedNodeId = null,
}: AssistantUIChatPanelProps) {
  const { t } = useTranslation();
  const [showSettings, setShowSettings] = useState(false);
  const [showThreadDrawer, setShowThreadDrawer] = useState(false);

  const activeDiagram = useActiveDiagramModel();
  const resolvedDiagram = useResolvedDiagram();

  const adapter = useAssistantUIAdapter();
  const runtime = useExternalStoreRuntime(adapter);

  const {
    messages,
    send,
    cancel,
    rerun,
    isLoading,
    streamingContent,
    activeThread,
    activeConnection,
    config,
    createThread,
  } = useLLMChat({ selectedNodeIds, selectedNodeId });

  const selectedNodeIdList = useMemo(() => Array.from(selectedNodeIds), [selectedNodeIds]);

  // Empty state is rendered *without* creating a thread — no auto-persistence.
  const hasMessages = messages.length > 0;

  // Command suggestions the empty state shows. Filtered by each command's
  // `when(ctx)` for the active selection/diagram. Up to 4 rows.
  const commandSuggestions = useMemo(
    () =>
      commandRegistry.suggest(
        { diagram: resolvedDiagram, selectionIds: selectedNodeIdList },
        4,
      ),
    [resolvedDiagram, selectedNodeIdList],
  );

  // ── Skeleton: briefly shown when switching to a thread that has no
  //    messages in memory yet (IndexedDB fetch is in-flight).
  const [showSkeleton, setShowSkeleton] = useState(false);
  const prevThreadIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeThread) {
      prevThreadIdRef.current = null;
      setShowSkeleton(false);
      return;
    }
    if (prevThreadIdRef.current !== activeThread.id) {
      // New thread: if it has no messages yet, show skeleton briefly.
      if (activeThread.messages.length === 0) {
        setShowSkeleton(true);
        const timer = setTimeout(() => setShowSkeleton(false), 700);
        return () => clearTimeout(timer);
      }
      setShowSkeleton(false);
    }
    prevThreadIdRef.current = activeThread.id;
  }, [activeThread]);

  // ── Auto-scroll: only scroll to bottom when user is already near bottom.
  //    We track whether the user was at bottom before the last content change.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const userAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);
  const prevStreamingRef = useRef<string | null>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const scrollable = el.closest("[data-aui-thread-viewport]") as HTMLElement | null;
    const target = scrollable ?? (el.parentElement as HTMLElement | null);
    if (!target) return;

    const dist = target.scrollHeight - target.scrollTop - target.clientHeight;
    userAtBottomRef.current = dist < 80;
  });

  // Scroll to bottom when new content arrives AND user was at bottom.
  useEffect(() => {
    const messageCountChanged = messages.length !== prevMessageCountRef.current;
    const streamingStarted = streamingContent !== null && prevStreamingRef.current === null;
    prevMessageCountRef.current = messages.length;
    prevStreamingRef.current = streamingContent;

    if (!userAtBottomRef.current) return;
    if (!messageCountChanged && !streamingStarted) return;

    const el = viewportRef.current;
    if (!el) return;
    const scrollable = el.closest("[data-aui-thread-viewport]") as HTMLElement | null;
    const target = scrollable ?? (el.parentElement as HTMLElement | null);
    if (!target) return;

    requestAnimationFrame(() => {
      target.scrollTo({ top: target.scrollHeight, behavior: "smooth" });
    });
  }, [messages.length, streamingContent]);

  // ── Cmd+K inside the chat focuses the composer. Canvas owns Cmd+K globally
  // (command palette) on /model, so only handle it when the event lands in this panel.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<{
    focusTextarea: () => void;
    setCommand: (command: PromptCommand) => void;
  } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) return;
      const root = panelRef.current;
      const target = e.target;
      if (!root || !(target instanceof Node) || !root.contains(target)) return;
      e.preventDefault();
      composerRef.current?.focusTextarea();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Without a usable connection a request can only fail, so open the settings
  // instead. Returns whether the message was sent, so the composer keeps the
  // draft when it was not.
  const handleSend = useCallback(
    async (
      text: string,
      mentions: Parameters<typeof send>[1],
      command?: Parameters<typeof send>[2],
    ): Promise<boolean> => {
      if (!isUsableConnection(config)) {
        setShowSettings(true);
        return false;
      }
      await send(text, mentions, command);
      return true;
    },
    [config, send],
  );

  const chatActions = useMemo<ChatActions>(
    () => ({
      openSettings: () => setShowSettings(true),
      rerun: (assistantMessageId) => {
        // A retry fails the same way without a usable connection.
        if (!isUsableConnection(config)) {
          setShowSettings(true);
          return;
        }
        void rerun(assistantMessageId);
      },
    }),
    [config, rerun],
  );

  const handleCreateThread = useCallback(() => {
    if (activeDiagram) {
      createThread(activeDiagram.id);
    }
  }, [activeDiagram, createThread]);

  // Header title: prefer the active thread's title; without one, fall back to
  // the assistant's name. The subtitle names the active connection.
  const threadedTitle =
    activeThread && activeThread.title && activeThread.title.length > 0
      ? activeThread.title
      : t("llmChat.title");
  const connectionName = activeConnection?.name ?? "";

  // Show typing indicator when loading but no streaming content yet.
  const showTyping = isLoading && !streamingContent && hasMessages;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatActionsContext.Provider value={chatActions}>
        <div
          ref={panelRef}
          className="relative flex h-full w-[26rem] max-w-[92vw] flex-col overflow-hidden rounded-l-xl border-l border-border bg-card shadow-2xl"
        >
          {/* Header */}
          <ChatHeader
            title={threadedTitle}
            connectionName={connectionName}
            onOpenThreads={() => setShowThreadDrawer(true)}
            onCreateThread={handleCreateThread}
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
              <ThreadPrimitive.Viewport ref={viewportRef} className="h-full w-full overflow-y-auto">
                <div className="flex flex-col gap-3 p-4">
                  {showSkeleton ? (
                    <SkeletonLoader />
                  ) : showTyping ? (
                    <TypingIndicator />
                  ) : hasMessages ? (
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
                      commands={commandSuggestions}
                      onSelectCommand={(command) => {
                        composerRef.current?.setCommand(command);
                      }}
                    />
                  )}
                </div>
              </ThreadPrimitive.Viewport>

              <ScrollToBottomAffordance viewportRef={viewportRef} />
            </ThreadPrimitive.Root>
          </div>

          {/* Composer */}
          <div className="shrink-0 space-y-2 border-t border-border bg-card/60 p-3">
            {!isUsableConnection(config) ? (
              <ConnectionBanner onConfigure={() => setShowSettings(true)} />
            ) : null}
            <AssistantUIComposer
              ref={composerRef}
              onSend={handleSend}
              onCancel={cancel}
              isLoading={isLoading}
              selectedNodeIds={selectedNodeIdList}
            />
            <div className="mt-2 flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground">{t("llmChat.disclaimer")}</p>
              <LLMSelector onOpenSettings={() => setShowSettings(true)} />
            </div>
          </div>

          {/* Settings */}
          {showSettings ? <LLMSettings onClose={() => setShowSettings(false)} /> : null}
        </div>
      </ChatActionsContext.Provider>
    </AssistantRuntimeProvider>
  );
});

/* --- Sub-components --- */

interface ChatHeaderProps {
  title: string;
  connectionName: string;
  onOpenThreads: () => void;
  onCreateThread: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

function ChatHeader({
  title,
  connectionName,
  onOpenThreads,
  onCreateThread,
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
            {t("llmChat.headerSubtitle", { name: connectionName })}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        <IconButton label={t("llmChat.threads.historyAria")} onClick={onOpenThreads}>
          <History className="h-4 w-4" />
        </IconButton>
        <IconButton label={t("llmChat.threads.newThread")} onClick={onCreateThread}>
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
  commands: readonly PromptCommand[];
  onSelectCommand: (command: PromptCommand) => void;
}

function EmptyState({ commands, onSelectCommand }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 overflow-y-auto py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-primary/5 text-primary ring-1 ring-primary/20">
        <Sparkles className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h4 className="text-base font-semibold text-foreground">{t("llmChat.title")}</h4>
        <p className="text-xs text-muted-foreground">{t("llmChat.emptySubtitle")}</p>
      </div>
      <div className="w-full space-y-1.5">
        {commands.map((command) => (
          <button
            key={command.id}
            type="button"
            onClick={() => onSelectCommand(command)}
            className="group flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-background/40 px-3 py-2.5 text-left text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <code className="font-mono text-[11px] font-semibold text-primary">/{command.name}</code>
            <span className="truncate">{t(command.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Banner above the composer when no usable connection is configured. The
 * composer still works and still opens settings on send; the banner is just
 * a heads-up so the user is not surprised by the redirect.
 */
function ConnectionBanner({ onConfigure }: { onConfigure: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200"
    >
      <span className="truncate">{t("llmChat.connectionBanner.message")}</span>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={onConfigure}
        className="h-7 border-amber-500/40 px-2 text-[11px] hover:bg-amber-500/15"
      >
        {t("llmChat.connectionBanner.configure")}
      </Button>
    </div>
  );
}

/* ── Scroll-to-bottom affordance ─────────────────────────────────────── */
interface ScrollToBottomAffordanceProps {
  viewportRef: React.RefObject<HTMLDivElement | null>;
}

function ScrollToBottomAffordance({ viewportRef }: ScrollToBottomAffordanceProps) {
  const { t } = useTranslation();
  const [atBottom, setAtBottom] = useState(true);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const scrollable = el.closest("[data-aui-thread-viewport]") as HTMLElement | null;
    const target = scrollable ?? (el.parentElement as HTMLElement | null);
    if (!target) return;

    const onScroll = () => {
      const dist = target.scrollHeight - target.scrollTop - target.clientHeight;
      setAtBottom(dist < 40);
    };

    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [viewportRef]);

  if (atBottom) return null;

  return (
    <div className="pointer-events-none sticky bottom-3 z-10 flex w-full justify-center">
      <button
        type="button"
        onClick={() => {
          const scrollable =
            (viewportRef.current?.closest("[data-aui-thread-viewport]") as HTMLElement | null) ??
            (viewportRef.current?.parentElement as HTMLElement | null);
          scrollable?.scrollTo({
            top: scrollable.scrollHeight,
            behavior: "smooth",
          });
        }}
        className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-foreground shadow-md transition-colors hover:bg-surface-hover"
      >
        <ChevronDown className="h-3 w-3" />
        {t("llmChat.scrollToBottom")}
      </button>
    </div>
  );
}
