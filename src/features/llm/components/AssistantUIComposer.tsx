"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KEY, keyIs } from "@/lib/keyboard-utils";
import { useMentionSearch } from "@/features/canvas/chat/useMentionSearch";
import { MentionPicker } from "./MentionPicker";
import { MentionTag } from "./MentionTag";
import type { MentionItem, ActiveMention } from "@/features/llm/types";

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

export interface AssistantUIComposerProps {
  onSend: (text: string, mentions: ActiveMention[]) => Promise<void>;
  onCancel?: () => Promise<void> | void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function AssistantUIComposer({
  onSend,
  onCancel,
  isLoading,
  disabled = false,
  placeholder,
}: AssistantUIComposerProps) {
  const { t } = useTranslation();
  const { search } = useMentionSearch();

  const [text, setText] = useState("");
  const [mentions, setMentions] = useState<ActiveMention[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [text]);

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

      const textBefore = text.slice(0, trigger.triggerIndex);
      const textAfter = text.slice(trigger.triggerEndIndex);
      const inserted = `@${item.label} `;
      const nextText = textBefore + inserted + textAfter;

      setText(nextText);
      setMentions((prev) => {
        if (prev.some((m) => m.mentionId === item.id)) return prev;
        return [...prev, { mentionId: item.id, label: item.label }];
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

  const handleRemoveMention = useCallback((mentionId: string) => {
    setMentions((prev) => prev.filter((m) => m.mentionId !== mentionId));
    setText((current) => {
      const mention = mentions.find((m) => m.mentionId === mentionId);
      if (!mention) return current;
      const marker = `@${mention.label}`;
      return current.replace(marker, "").replace(/\s+/g, " ").trimStart();
    });
  }, [mentions]);

  const handleClear = useCallback(() => {
    setText("");
    setMentions([]);
    setIsPickerOpen(false);
    setMentionQuery("");
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || isLoading || disabled) return;
    await onSend(trimmed, mentions);
    handleClear();
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [text, isLoading, disabled, onSend, mentions, handleClear]);

  const handleCancel = useCallback(() => {
    if (!onCancel) return;
    void onCancel();
  }, [onCancel]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
      if (isSubmit && !isPickerOpen) {
        event.preventDefault();
        void handleSend();
      }
    },
    [
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
            <MentionTag key={m.mentionId} mention={m} onRemove={handleRemoveMention} />
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
            {isLoading
              ? t("llmChat.sending")
              : t("llmChat.submitHint", { defaultValue: t("llmChat.submitHint") })}
          </p>
          {canCancel ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={handleCancel}
              className="h-8 w-8 rounded-full"
              aria-label={t("common.cancel")}
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
}
