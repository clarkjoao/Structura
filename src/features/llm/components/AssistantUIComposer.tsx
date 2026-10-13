"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, Loader2, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLLMStore } from "@/features/llm";
import { cn } from "@/lib/utils";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { useMentionSearch } from "@/features/llm/hooks/useMentionSearch";
import { MentionPicker } from "./MentionPicker";
import { MentionTag } from "./MentionTag";
import type { MentionItem } from "@/features/llm/types";
import { mentionKey, type MentionRef } from "@/features/llm/mentions/mention-ref";
import { conversationToMarkdown } from "@/features/llm/message-markdown";

const MENTION_TRIGGER_PATTERN = /(?:^|\s)@([^\s@]*)$/;

function findMentionTrigger(
  value: string,
): { query: string; triggerIndex: number; triggerEndIndex: number } | null {
  const match = value.match(MENTION_TRIGGER_PATTERN);
  if (!match) return null;
  const query = match[1] ?? "";
  const triggerIndex = value.length - query.length - 1;
  const triggerEndIndex = triggerIndex + 1 + query.length;
  return { query, triggerIndex, triggerEndIndex };
}

/* ── Slash commands ───────────────────────────────────────────────────── */
export interface SlashCommandDef {
  names: string[]; // Both PT and EN aliases
  labelKey: string;
  descriptionKey: string;
}

const SLASH_COMMANDS: SlashCommandDef[] = [
  {
    names: ["limpar", "clear"],
    labelKey: "llmChat.slash.clear",
    descriptionKey: "llmChat.slash.clearDesc",
  },
  {
    names: ["copiar", "copy"],
    labelKey: "llmChat.slash.copy",
    descriptionKey: "llmChat.slash.copyDesc",
  },
];

/** Returns all commands that match the partial input after `/` */
function filterSlashCommands(input: string): SlashCommandDef[] {
  const trimmed = input.trimStart().toLowerCase();
  if (!trimmed.startsWith("/")) return [];
  const query = trimmed.slice(1).toLowerCase();

  if (!query) return SLASH_COMMANDS;

  return SLASH_COMMANDS.filter((cmd) =>
    cmd.names.some((name) => name.toLowerCase().startsWith(query)),
  );
}

function SlashCommandMenu({
  commands,
  selectedIndex,
  onSelect,
}: {
  commands: SlashCommandDef[];
  selectedIndex: number;
  onSelect: (c: SlashCommandDef) => void;
}) {
  const { t } = useTranslation();

  if (commands.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 mb-1.5 w-60 rounded-xl border border-border bg-card shadow-lg">
      <div className="px-2.5 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("llmChat.slash.title")}
        </p>
      </div>
      {commands.map((cmd, i) => (
        <button
          key={cmd.names[0]}
          type="button"
          onClick={() => onSelect(cmd)}
          className={cn(
            "flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors",
            i === selectedIndex ? "bg-primary/10" : "hover:bg-accent",
          )}
        >
          <span className="flex items-center gap-2 text-xs font-medium text-foreground">
            <span className="flex h-5 min-w-[2rem] items-center rounded bg-muted px-1.5 text-[11px] font-mono">
              /{cmd.names[0]}
            </span>
          </span>
          <span className="text-[11px] text-muted-foreground">{t(cmd.descriptionKey)}</span>
        </button>
      ))}
    </div>
  );
}

/* ── Main composer ────────────────────────────────────────────────────── */
export interface AssistantUIComposerProps {
  /** Resolves to `false` when the message was not sent, so the draft is kept. */
  onSend: (text: string, mentions: MentionRef[]) => Promise<boolean | void>;
  onCancel?: () => Promise<void> | void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Clear chat history */
  onClearHistory?: () => void;
}

export interface AssistantUIComposerRef {
  focusTextarea: () => void;
}

export const AssistantUIComposer = forwardRef<AssistantUIComposerRef, AssistantUIComposerProps>(
  function AssistantUIComposer(
    { onSend, onCancel, isLoading, disabled = false, placeholder, onClearHistory },
    ref,
  ) {
    const { t } = useTranslation();
    const { search } = useMentionSearch();
    const messages = useLLMStore((s) => s.messages);
    const pendingSuggestions = useLLMStore((s) => s.pendingSuggestions);
    const activeDiagramId = useLLMStore((s) => s.activeDiagramId);
    const createThread = useLLMStore((s) => s.createThread);

    const [text, setText] = useState("");
    const [mentions, setMentions] = useState<MentionRef[]>([]);
    const [isPickerOpen, setIsPickerOpen] = useState(false);
    const [mentionQuery, setMentionQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    // Slash command menu
    const [slashMenuOpen, setSlashMenuOpen] = useState(false);
    const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Filtered commands based on current input
    const filteredCommands = useMemo(() => filterSlashCommands(text), [text]);

    // Expose focusTextarea via ref for Cmd+K support.
    useImperativeHandle(
      ref,
      () => ({
        focusTextarea: () => {
          textareaRef.current?.focus();
          textareaRef.current?.select();
        },
      }),
      [],
    );

    // Auto-resize textarea to fit content
    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
    }, [text]);

    // Show slash menu when text starts with /
    useEffect(() => {
      const trimmed = text.trimStart();
      if (trimmed.startsWith("/") && trimmed.length >= 1) {
        setSlashMenuOpen(true);
        // Reset selection when query changes
        if (slashSelectedIndex >= filteredCommands.length) {
          setSlashSelectedIndex(Math.max(0, filteredCommands.length - 1));
        }
      } else {
        setSlashMenuOpen(false);
      }
    }, [text, filteredCommands.length, slashSelectedIndex]);

    const mentionItems = useMemo(() => {
      if (!isPickerOpen) return [];
      return search(mentionQuery).slice(0, 8);
    }, [isPickerOpen, mentionQuery, search]);

    // Track the last (query, open) tuple we saw, so we can reset the index
    // *as part of the input update* instead of via a setState-in-effect.
    const pickerKeyRef = useRef("");

    const updateText = useCallback((next: string) => {
      setText(next);
      const trigger = findMentionTrigger(next);
      if (!trigger) {
        setIsPickerOpen(false);
        setMentionQuery("");
        pickerKeyRef.current = "";
        return;
      }
      setIsPickerOpen(true);
      setMentionQuery(trigger.query);
      const nextKey = `${true}:${trigger.query}`;
      if (pickerKeyRef.current !== nextKey) {
        pickerKeyRef.current = nextKey;
        setSelectedIndex(0);
      }
    }, []);

    // Reset selection when picker is dismissed externally (Escape, click outside).
    const handleDismissPicker = useCallback(() => {
      setIsPickerOpen(false);
      setMentionQuery("");
      pickerKeyRef.current = "";
    }, []);

    const handleSelectMention = useCallback(
      (item: MentionItem) => {
        const trigger = findMentionTrigger(text);
        if (!trigger) return;

        // The "@query" text goes away; the element becomes a chip.
        const textBefore = text.slice(0, trigger.triggerIndex);
        const textAfter = text.slice(trigger.triggerEndIndex);
        const inserted = "";
        const nextText = textBefore + inserted + textAfter;

        setText(nextText);
        setMentions((prev) => {
          if (prev.some((ref) => mentionKey(ref) === mentionKey(item.ref))) return prev;
          return [...prev, item.ref];
        });
        setIsPickerOpen(false);
        setMentionQuery("");

        // Restore cursor position
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (!el) return;
          const pos = (textBefore + inserted).length;
          el.focus();
          el.setSelectionRange(pos, pos);
        });
      },
      [text],
    );

    const handleRemoveMention = useCallback((key: string) => {
      setMentions((prev) => prev.filter((ref) => mentionKey(ref) !== key));
    }, []);

    /** Execute a slash command and clear the input. */
    const executeSlashCommand = useCallback(
      (cmd: SlashCommandDef) => {
        setSlashMenuOpen(false);
        setText("");

        const cmdName = cmd.names[0];

        switch (cmdName) {
          case "limpar":
          case "clear": {
            if (window.confirm(t("llmChat.slash.clearConfirm"))) {
              if (activeDiagramId) {
                createThread(activeDiagramId);
                toast(t("llmChat.slash.newChat"));
              } else {
                onClearHistory?.();
                toast(t("llmChat.slash.cleared"));
              }
            }
            break;
          }

          case "copiar":
          case "copy": {
            if (messages.length === 0) {
              toast(t("llmChat.slash.noMessages"));
              break;
            }
            const formatted = conversationToMarkdown(messages, {
              t,
              findSuggestion: (id) => pendingSuggestions.find((suggestion) => suggestion.id === id),
            });
            navigator.clipboard
              .writeText(formatted)
              .then(() => {
                toast(t("llmChat.slash.copied"));
              })
              .catch(() => {
                toast(t("llmChat.slash.copyFailed"));
              });
            break;
          }
        }
      },
      [messages, pendingSuggestions, activeDiagramId, createThread, onClearHistory, t],
    );

    const handleClear = useCallback(() => {
      setText("");
      setMentions([]);
      setIsPickerOpen(false);
      setMentionQuery("");
      setSlashMenuOpen(false);
    }, []);

    const handleSend = useCallback(async () => {
      const trimmed = text.trim();
      if ((!trimmed && mentions.length === 0) || isLoading || disabled) return;
      const sent = await onSend(trimmed, mentions);
      if (sent === false) return;
      handleClear();
      requestAnimationFrame(() => textareaRef.current?.focus());
    }, [text, isLoading, disabled, onSend, mentions, handleClear]);

    const handleCancel = useCallback(() => {
      if (!onCancel) return;
      void onCancel();
    }, [onCancel]);

    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // ── Slash command navigation ──
        if (slashMenuOpen && filteredCommands.length > 0) {
          if (keyIs(event, KEY.ARROW_DOWN)) {
            event.preventDefault();
            setSlashSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
            return;
          }
          if (keyIs(event, KEY.ARROW_UP)) {
            event.preventDefault();
            setSlashSelectedIndex((i) => Math.max(i - 1, 0));
            return;
          }
          if (keyIs(event, KEY.ENTER)) {
            event.preventDefault();
            executeSlashCommand(filteredCommands[slashSelectedIndex]);
            return;
          }
          if (keyIs(event, KEY.ESCAPE)) {
            event.preventDefault();
            setSlashMenuOpen(false);
            return;
          }
        }

        // ── Mention picker navigation ──
        if (isPickerOpen && keyIs(event, KEY.ARROW_DOWN)) {
          event.preventDefault();
          setSelectedIndex((idx) => Math.min(idx + 1, Math.max(mentionItems.length - 1, 0)));
          return;
        }
        if (isPickerOpen && keyIs(event, KEY.ARROW_UP)) {
          event.preventDefault();
          setSelectedIndex((idx) => Math.max(idx - 1, 0));
          return;
        }
        if (isPickerOpen && keyIs(event, KEY.ENTER)) {
          event.preventDefault();
          const item = mentionItems[selectedIndex];
          if (item) handleSelectMention(item);
          return;
        }
        if (keyIs(event, KEY.ESCAPE)) {
          if (isPickerOpen) {
            event.preventDefault();
            handleDismissPicker();
          }
          return;
        }
        const isSubmit = (event.metaKey || event.ctrlKey) && keyIs(event, KEY.ENTER);
        if (isSubmit && !isPickerOpen && !slashMenuOpen) {
          event.preventDefault();
          void handleSend();
        }
      },
      [
        slashMenuOpen,
        filteredCommands,
        slashSelectedIndex,
        executeSlashCommand,
        isPickerOpen,
        mentionItems,
        selectedIndex,
        handleSelectMention,
        handleDismissPicker,
        handleSend,
      ],
    );

    const canSubmit = text.trim().length > 0 && !isLoading && !disabled;
    const canCancel = isLoading && Boolean(onCancel);

    return (
      <div className="relative">
        {/* Slash command menu - shows as you type / */}
        {slashMenuOpen && (
          <SlashCommandMenu
            commands={filteredCommands}
            selectedIndex={slashSelectedIndex}
            onSelect={executeSlashCommand}
          />
        )}

        {/* Mention picker */}
        {isPickerOpen && (
          <MentionPicker
            items={mentionItems}
            selectedIndex={selectedIndex}
            onSelect={handleSelectMention}
            onDismiss={handleDismissPicker}
          />
        )}

        {/* Mention chips */}
        {mentions.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {mentions.map((m) => (
              <MentionTag key={mentionKey(m)} mention={m} onRemove={handleRemoveMention} />
            ))}
          </div>
        )}

        {/* Composer body */}
        <div
          className={cn(
            "relative flex flex-col rounded-2xl border border-border bg-background transition-colors",
            "focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15",
            (disabled || isLoading) && "opacity-70",
          )}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => updateText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? t("llmChat.inputPlaceholder")}
            disabled={disabled}
            rows={1}
            aria-label={t("llmChat.inputPlaceholder")}
            className={cn(
              "block w-full resize-none bg-transparent px-4 pb-2 pt-3 text-sm leading-relaxed",
              "placeholder:text-muted-foreground focus:outline-none",
              "min-h-[2.5rem] max-h-[15rem] overflow-y-auto",
            )}
          />

          {/* Footer bar */}
          <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
            <p className="text-[11px] text-muted-foreground">
              {isLoading ? t("llmChat.sending") : t("llmChat.submitHint")}
            </p>
            {canCancel ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={handleCancel}
                className="h-8 w-8 rounded-full"
                aria-label={t("llmChat.stop")}
                title={t("llmChat.stop")}
              >
                <Square className="h-3 w-3 fill-current" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={() => void handleSend()}
                disabled={!canSubmit}
                className="h-8 w-8 rounded-full"
                aria-label={t("llmChat.send")}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowDown className="h-4 w-4 -rotate-90" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  },
);
