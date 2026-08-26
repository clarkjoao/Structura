"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquarePlus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import type { Locale } from "date-fns";
import { useLLMChat } from "@/features/canvas/chat";
import { ThreadRenameControl } from "./ThreadRenameControl";
import type { ConversationThread } from "@/features/llm";

interface ThreadDrawerProps {
  open: boolean;
  onClose: () => void;
}

type ThreadGroup = {
  label: string;
  items: ConversationThread[];
};

function groupThreadsByDate(
  threads: ConversationThread[],
  locale: Locale,
): ThreadGroup[] {
  const today: ConversationThread[] = [];
  const yesterday: ConversationThread[] = [];
  const earlier = new Map<string, ConversationThread[]>();

  // Sort by updatedAt desc
  const sorted = [...threads].sort((a, b) => b.updatedAt - a.updatedAt);

  for (const thread of sorted) {
    if (isToday(thread.updatedAt)) {
      today.push(thread);
    } else if (isYesterday(thread.updatedAt)) {
      yesterday.push(thread);
    } else {
      const key = format(thread.updatedAt, "MMMM yyyy", { locale });
      if (!earlier.has(key)) {
        earlier.set(key, []);
      }
      earlier.get(key)!.push(thread);
    }
  }

  const groups: ThreadGroup[] = [];
  if (today.length) groups.push({ label: "Today", items: today });
  if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
  for (const [label, items] of earlier) {
    if (items.length) groups.push({ label, items });
  }
  return groups;
}

export function ThreadDrawer({ open, onClose }: ThreadDrawerProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "pt-BR" ? ptBR : enUS;
  const drawerRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");

  const {
    threads,
    activeThread,
    createThread,
    switchThread,
    renameThread,
    deleteThread,
  } = useLLMChat({ selectedNodeIds: new Set(), selectedNodeId: null });

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, onClose]);

  const handleSelectThread = useCallback(
    (threadId: string) => {
      switchThread(threadId);
      onClose();
    },
    [switchThread, onClose],
  );

  const handleCreateThread = useCallback(() => {
    // Use the active diagram if known — `useLLMChat` switches by activeDiagram
    // context, so passing `undefined` would still attempt to create one
    // against the active diagram (or `null` if none).
    const diagramId = activeThread?.diagramId;
    if (diagramId) {
      createThread(diagramId);
    }
    onClose();
  }, [activeThread, createThread, onClose]);

  const handleDeleteThread = useCallback(
    (threadId: string) => {
      const confirmed = window.confirm(t("llmChat.threads.deleteConfirm"));
      if (confirmed) deleteThread(threadId);
    },
    [deleteThread, t],
  );

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    const needle = search.trim().toLowerCase();
    return threads.filter((thread) => thread.title.toLowerCase().includes(needle));
  }, [threads, search]);

  const grouped = useMemo(
    () => groupThreadsByDate(filteredThreads, locale),
    [filteredThreads, locale],
  );

  return (
    <>
      {open && (
        <div
          className="absolute inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        ref={drawerRef}
        className={cn(
          "absolute inset-y-0 left-0 z-50 flex w-[20rem] max-w-[88vw] flex-col border-r border-border bg-card shadow-2xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full pointer-events-none",
        )}
        role="dialog"
        aria-label={t("llmChat.threads.historyLabel")}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <h3 className="text-sm font-semibold">{t("llmChat.threads.historyLabel")}</h3>
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

        {/* Search */}
        <div className="border-b border-border px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("llmChat.threads.searchPlaceholder", {
                defaultValue: "Search…",
              })}
              className="h-8 pl-8 text-xs"
              aria-label={t("llmChat.threads.searchPlaceholder", {
                defaultValue: "Search…",
              })}
            />
          </div>
        </div>

        {/* New thread button */}
        <div className="border-b border-border px-3 py-2">
          <Button
            type="button"
            variant="default"
            size="sm"
            className="w-full justify-center gap-2 text-xs"
            onClick={handleCreateThread}
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
            {t("llmChat.threads.newThread")}
          </Button>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {threads.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {t("llmChat.threads.empty")}
            </p>
          ) : filteredThreads.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {t("llmChat.threads.noMatches", { defaultValue: "No conversations match." })}
            </p>
          ) : (
            <div className="space-y-3">
              {grouped.map((group) => (
                <div key={group.label}>
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map((thread) => {
                      const isActive = thread.id === activeThread?.id;
                      const timeAgo = formatDistanceToNow(thread.updatedAt, {
                        addSuffix: true,
                        locale,
                      });

                      return (
                        <div
                          key={thread.id}
                          className={cn(
                            "group flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors",
                            isActive
                              ? "bg-primary/10 text-foreground"
                              : "hover:bg-accent hover:text-accent-foreground",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => handleSelectThread(thread.id)}
                            className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left"
                          >
                            <span className="line-clamp-1 w-full font-medium">
                              {thread.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {thread.messages.length} · {timeAgo}
                            </span>
                          </button>

                          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                            {isActive && (
                              <span className="rounded bg-primary/15 px-1 py-0.5 text-[10px] text-primary">
                                {t("llmChat.threads.active")}
                              </span>
                            )}
                            <ThreadRenameControl
                              threadId={thread.id}
                              currentTitle={thread.title}
                              onRename={renameThread}
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteThread(thread.id);
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
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
