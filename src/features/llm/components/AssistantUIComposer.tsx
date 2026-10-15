"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowUp, Loader2, MousePointer2, Sparkles, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { commandRegistry } from "@/features/llm/commands/builtins";
import {
  isPromptCommand,
  isSkillCommand,
  type PromptCommand,
} from "@/features/llm/commands/registry";
import { useCommandActions } from "@/features/llm/hooks/useCommandActions";
import { useResolvedDiagram } from "@/features/llm/hooks/useResolvedDiagram";
import { isSelectionRef, mentionKey, type MentionRef } from "@/features/llm/mentions/mention-ref";
import { createMentionRegistry } from "@/features/llm/mentions/providers";
import type { CommandRef, QueuedMessage } from "@/features/llm/types";
import { MAX_QUEUED_MESSAGES } from "@/features/llm/types";
import { findSkill, useSkillStore } from "@/features/llm/skills/skill-store";
import { skillKey, toSkillRef, type SkillRef } from "@/features/llm/skills/skill.types";
import { SkillSourceBadge } from "./skills/SkillSourceBadge";
import { ComposerMenu } from "./composer/ComposerMenu";
import {
  buildMenuSections,
  findTrigger,
  flattenItems,
  isCommandMenuItem,
  isMentionTrigger,
  removeTrigger,
  type MenuItem,
  type MenuTrigger,
} from "./composer/composer-menu";
import { ModelPicker } from "./ModelPicker";
import { QueuedMessagesBar } from "./QueuedMessagesBar";

const mentionRegistry = createMentionRegistry();

export interface AssistantUIComposerProps {
  /** Resolves to `false` when the message was not sent, so the draft is kept. */
  onSend: (
    text: string,
    mentions: MentionRef[],
    command?: CommandRef,
    skills?: SkillRef[],
  ) => Promise<boolean | void>;
  onCancel?: () => Promise<void> | void;
  isLoading: boolean;
  /** Messages held in the store while the assistant is busy. */
  queuedMessages?: readonly QueuedMessage[];
  /** Removes one queued message by id. */
  onRemoveQueued?: (id: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** Node ids selected on the canvas, passed down by the panel. */
  selectedNodeIds?: readonly string[];
  /** The active conversation; skill chips stay until it changes. */
  conversationId?: string;
}

export interface AssistantUIComposerRef {
  focusTextarea: () => void;
  /** Sets a prompt command chip (empty-state suggestions) and focuses the composer. */
  setCommand: (command: PromptCommand) => void;
}

export const AssistantUIComposer = forwardRef<AssistantUIComposerRef, AssistantUIComposerProps>(
  function AssistantUIComposer(
    {
      onSend,
      onCancel,
      isLoading,
      queuedMessages = [],
      onRemoveQueued,
      disabled = false,
      placeholder,
      selectedNodeIds = [],
      conversationId = "",
    },
    ref,
  ) {
    const { t } = useTranslation();
    const diagram = useResolvedDiagram();
    const commandActions = useCommandActions();
    const listId = useId();
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const [text, setText] = useState("");
    const [caret, setCaret] = useState(0);
    const [mentions, setMentions] = useState<MentionRef[]>([]);
    const [command, setCommandState] = useState<PromptCommand | null>(null);
    /** Sticky: skill chips stay across turns until removed or the conversation changes. */
    const [skillRefs, setSkillRefs] = useState<SkillRef[]>([]);
    const allSkills = useSkillStore((state) => state.skills);
    const skillsLoaded = useSkillStore((state) => state.loaded);
    /** The trigger the user closed with Esc; the menu stays shut until the text changes. */
    const [dismissedAt, setDismissedAt] = useState<string | null>(null);
    const [activeKey, setActiveKey] = useState("");
    const [activeDescendant, setActiveDescendant] = useState<string | undefined>(undefined);
    /** The user removed the automatic selection chip for the current selection. */
    const [selectionChipDismissed, setSelectionChipDismissed] = useState(false);

    const selectionKey = selectedNodeIds.join(",");
    useEffect(() => {
      // A different selection brings the automatic chip back.
      setSelectionChipDismissed(false);
    }, [selectionKey]);

    // Another conversation starts without the previous one's skills. Starting
    // the first conversation (no id yet) keeps the chips the user just set.
    const previousConversation = useRef(conversationId);
    useEffect(() => {
      if (previousConversation.current && previousConversation.current !== conversationId) {
        setSkillRefs([]);
      }
      previousConversation.current = conversationId;
    }, [conversationId]);

    // A skill deleted (or disabled) in settings leaves the composer too.
    useEffect(() => {
      if (!skillsLoaded) return;
      setSkillRefs((current) => {
        const kept = current.filter((ref) => findSkill(allSkills, ref)?.enabled);
        return kept.length === current.length ? current : kept;
      });
    }, [allSkills, skillsLoaded]);

    /** The chips as the skills are now: a rename in settings shows at once. */
    const activeSkills = useMemo(
      () =>
        skillRefs.map((ref) => {
          const skill = findSkill(allSkills, ref);
          return skill ? toSkillRef(skill) : ref;
        }),
      [skillRefs, allSkills],
    );

    const selectionIdsInDiagram = useMemo(
      () => selectedNodeIds.filter((id) => (diagram ? id in diagram.snapshot.components : false)),
      [selectedNodeIds, diagram],
    );

    /** The automatic "Selection · …" chip: follows the canvas until removed or sent. */
    const autoSelection = useMemo((): MentionRef | null => {
      if (selectionChipDismissed || selectionIdsInDiagram.length === 0 || !diagram) return null;
      if (mentions.some(isSelectionRef)) return null;
      const first = diagram.snapshot.components[selectionIdsInDiagram[0] ?? ""];
      const label =
        selectionIdsInDiagram.length === 1 && first
          ? first.name
          : t("llmChat.mention.selectionCount", { count: selectionIdsInDiagram.length });
      return { kind: "selection", nodeIds: selectionIdsInDiagram, label };
    }, [selectionChipDismissed, selectionIdsInDiagram, diagram, mentions, t]);

    const trigger: MenuTrigger | null = useMemo(() => {
      const found = findTrigger(text, caret, command === null);
      if (!found) return null;
      return dismissedAt === `${found.mode}:${text}` ? null : found;
    }, [text, caret, command, dismissedAt]);

    const translate = useCallback(
      (key: string, params?: Record<string, unknown>) => t(key, params),
      [t],
    );

    const sections = useMemo(
      () =>
        trigger
          ? buildMenuSections(
              trigger,
              mentionRegistry,
              { diagram, selectionIds: selectionIdsInDiagram, translate },
              commandRegistry,
              { diagram, selectionIds: selectionIdsInDiagram, skills: allSkills },
            )
          : [],
      [trigger, diagram, selectionIdsInDiagram, translate, allSkills],
    );
    const items = useMemo(() => flattenItems(sections), [sections]);
    const menuOpen = trigger !== null;

    // Keep the active item valid as the list changes.
    useEffect(() => {
      if (!items.some((item) => item.key === activeKey)) setActiveKey(items[0]?.key ?? "");
    }, [items, activeKey]);

    // The textarea points at the item cmdk renders as selected.
    useLayoutEffect(() => {
      if (!menuOpen) {
        setActiveDescendant(undefined);
        return;
      }
      const selected = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
      setActiveDescendant(selected?.id || undefined);
    }, [menuOpen, activeKey, items]);

    const focusTextarea = useCallback(() => {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        focusTextarea: () => {
          textareaRef.current?.focus();
          textareaRef.current?.select();
        },
        setCommand: (next) => {
          setCommandState(next);
          focusTextarea();
        },
      }),
      [focusTextarea],
    );

    // Auto-resize textarea to fit content.
    useEffect(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
    }, [text]);

    const updateText = (next: string, nextCaret: number) => {
      setText(next);
      setCaret(nextCaret);
      setDismissedAt(null);
    };

    const choose = useCallback(
      (item: MenuItem) => {
        if (!trigger) return;
        const nextText = removeTrigger(text, trigger);
        setText(nextText);
        setCaret(trigger.start);
        if (isCommandMenuItem(item)) {
          if (isPromptCommand(item.command)) {
            setCommandState(item.command);
          } else if (isSkillCommand(item.command)) {
            const ref = toSkillRef(item.command.skill);
            setSkillRefs((current) =>
              current.some((existing) => skillKey(existing) === skillKey(ref))
                ? current
                : [...current, ref],
            );
          } else {
            void item.command.run(commandActions);
          }
        } else {
          const ref = item.option.ref;
          setMentions((current) =>
            current.some((existing) => mentionKey(existing) === mentionKey(ref))
              ? current
              : [...current, ref],
          );
        }
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (!el) return;
          el.focus();
          el.setSelectionRange(trigger.start, trigger.start);
        });
      },
      [trigger, text, commandActions],
    );

    const removeMention = useCallback((key: string) => {
      setMentions((current) => current.filter((ref) => mentionKey(ref) !== key));
    }, []);

    const removeSkill = useCallback((key: string) => {
      setSkillRefs((current) => current.filter((ref) => skillKey(ref) !== key));
    }, []);

    /**
     * Removes the last chip: mentions first (newest last), then the selection,
     * then the command, then the skills.
     */
    const removeLastChip = useCallback(() => {
      if (mentions.length > 0) {
        setMentions((current) => current.slice(0, -1));
      } else if (autoSelection) {
        setSelectionChipDismissed(true);
      } else if (command) {
        setCommandState(null);
      } else if (skillRefs.length > 0) {
        setSkillRefs((current) => current.slice(0, -1));
      }
    }, [mentions.length, autoSelection, command, skillRefs.length]);

    const reset = useCallback(() => {
      setText("");
      setCaret(0);
      setMentions([]);
      setCommandState(null);
      setDismissedAt(null);
      // The selection that was sent stays out of the next draft until it changes.
      setSelectionChipDismissed(true);
    }, []);

    const send = useCallback(async () => {
      const trimmed = text.trim();
      const refs = autoSelection ? [autoSelection, ...mentions] : mentions;
      if ((!trimmed && refs.length === 0 && !command) || disabled) return;
      const draftText = trimmed;
      const draftMentions = refs;
      const draftCommand = command ? { id: command.id, name: command.name } : undefined;
      const draftSkills = activeSkills;
      // Clear the input first, so the user can type the next message right away
      // regardless of how long the send takes. Skill chips are not reset: they
      // stay for the rest of the conversation.
      reset();
      const sent = await onSend(draftText, draftMentions, draftCommand, draftSkills);
      if (sent === false) {
        // The store refused the message (the queue is full): put the draft
        // back as it was, so nothing the user typed is lost.
        setText(text);
        setCaret(text.length);
        setMentions(mentions);
        setCommandState(command);
        setSelectionChipDismissed(selectionChipDismissed);
        toast.error(t("llmChat.queue.full", { max: MAX_QUEUED_MESSAGES }));
      }
      focusTextarea();
    }, [
      text,
      autoSelection,
      mentions,
      command,
      activeSkills,
      selectionChipDismissed,
      disabled,
      onSend,
      reset,
      focusTextarea,
      t,
    ]);

    const moveActive = (step: number) => {
      if (items.length === 0) return;
      const index = items.findIndex((item) => item.key === activeKey);
      const next = (index + step + items.length) % items.length;
      setActiveKey(items[next]?.key ?? "");
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (menuOpen) {
        if (keyIs(event, KEY.ARROW_DOWN) || keyIs(event, KEY.ARROW_UP)) {
          event.preventDefault();
          moveActive(keyIs(event, KEY.ARROW_DOWN) ? 1 : -1);
          return;
        }
        const active = items.find((item) => item.key === activeKey);
        if (
          (keyIs(event, KEY.ENTER) || keyIs(event, KEY.TAB)) &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey
        ) {
          if (active) {
            event.preventDefault();
            choose(active);
            return;
          }
        }
        if (keyIs(event, KEY.ESCAPE) && trigger) {
          event.preventDefault();
          setDismissedAt(`${trigger.mode}:${text}`);
          return;
        }
      }
      if (keyIs(event, KEY.BACKSPACE) && text.length === 0) {
        event.preventDefault();
        removeLastChip();
        return;
      }
      // Enter sends, Shift+Enter breaks the line. Cmd/Ctrl+Enter also sends
      // (covers muscle memory from the old behavior).
      if (keyIs(event, KEY.ENTER) && !event.shiftKey && (event.metaKey || event.ctrlKey || true)) {
        event.preventDefault();
        void send();
      }
    };

    /** The @ and / buttons type their trigger and open the menu. */
    const insertTrigger = (character: "@" | "/") => {
      const el = textareaRef.current;
      const at = el?.selectionStart ?? text.length;
      if (character === "/") {
        if (command) return;
        updateText(`/${text.trimStart()}`, 1);
        requestAnimationFrame(() => {
          el?.focus();
          el?.setSelectionRange(1, 1);
        });
        return;
      }
      const needsSpace = at > 0 && !/\s/.test(text[at - 1] ?? "");
      const insert = `${needsSpace ? " " : ""}@`;
      const next = text.slice(0, at) + insert + text.slice(at);
      updateText(next, at + insert.length);
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(at + insert.length, at + insert.length);
      });
    };

    const chips: Array<{ key: string; ref: MentionRef; auto: boolean }> = [
      ...(autoSelection ? [{ key: "auto-selection", ref: autoSelection, auto: true }] : []),
      ...mentions.map((ref) => ({ key: mentionKey(ref), ref, auto: false })),
    ];
    const canSubmit = (text.trim().length > 0 || chips.length > 0 || command !== null) && !disabled;
    const canCancel = isLoading && Boolean(onCancel);
    const sendHint = t("llmChat.sendHint");
    const menuLabelKey =
      trigger && isMentionTrigger(trigger)
        ? "llmChat.menu.mentionLabel"
        : "llmChat.menu.commandLabel";

    return (
      <div className="relative">
        {queuedMessages.length > 0 && onRemoveQueued ? (
          <QueuedMessagesBar messages={queuedMessages} onRemove={onRemoveQueued} />
        ) : null}
        {menuOpen ? (
          <ComposerMenu
            ref={listRef}
            listId={listId}
            labelKey={menuLabelKey}
            sections={sections}
            activeKey={activeKey}
            onActiveKeyChange={setActiveKey}
            onChoose={choose}
          />
        ) : null}

        <div
          className={cn(
            "flex flex-col gap-2 rounded-xl border border-input bg-background px-2.5 pb-2 pt-2.5 transition-colors",
            "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/15",
            (disabled || isLoading) && "opacity-80",
          )}
        >
          {command || chips.length > 0 || skillRefs.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {activeSkills.map((ref) => (
                <SkillChip
                  key={skillKey(ref)}
                  skill={ref}
                  removeLabel={t("llmChat.skills.removeChip", { name: ref.name })}
                  onRemove={() => removeSkill(skillKey(ref))}
                />
              ))}
              {command ? (
                <Chip
                  label={`/${command.name}`}
                  mono
                  removeLabel={t("llmChat.command.remove", { name: command.name })}
                  onRemove={() => setCommandState(null)}
                />
              ) : null}
              {chips.map(({ key, ref, auto }) => (
                <Chip
                  key={key}
                  icon={isSelectionRef(ref)}
                  label={
                    isSelectionRef(ref)
                      ? t("llmChat.mention.selectionChip", { label: ref.label })
                      : `@${ref.label}`
                  }
                  removeLabel={t("llmChat.mention.removeTag", { label: ref.label })}
                  onRemove={() => (auto ? setSelectionChipDismissed(true) : removeMention(key))}
                />
              ))}
            </div>
          ) : null}

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => updateText(event.target.value, event.target.selectionStart)}
            onSelect={(event) => setCaret(event.currentTarget.selectionStart)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? t("llmChat.inputPlaceholder")}
            disabled={disabled}
            rows={1}
            aria-label={t("llmChat.inputLabel")}
            aria-autocomplete="list"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? listId : undefined}
            aria-activedescendant={activeDescendant}
            className="block max-h-[15rem] min-h-[2.5rem] w-full resize-none overflow-y-auto bg-transparent px-1.5 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none"
          />

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 font-mono text-sm"
              aria-label={t("llmChat.menu.openMention")}
              title={t("llmChat.menu.openMention")}
              onClick={() => insertTrigger("@")}
            >
              @
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 font-mono text-sm"
              aria-label={t("llmChat.menu.openCommand")}
              title={t("llmChat.menu.openCommand")}
              onClick={() => insertTrigger("/")}
              disabled={command !== null}
            >
              /
            </Button>
            <ModelPicker />
            <span className="ml-auto pr-1 text-[11px] text-muted-foreground" aria-hidden>
              {sendHint}
            </span>
            {canCancel ? (
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={() => void onCancel?.()}
                className="h-8 w-8 rounded-full"
                aria-label={t("llmChat.stop")}
                title={t("llmChat.stop")}
              >
                <Square className="h-3 w-3 fill-current" />
              </Button>
            ) : null}
            <Button
              type="button"
              size="icon"
              onClick={() => void send()}
              disabled={!canSubmit}
              className="h-8 w-8 rounded-full"
              aria-label={t("llmChat.send")}
              title={t("llmChat.send")}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  },
);

function Chip({
  label,
  removeLabel,
  onRemove,
  mono = false,
  icon = false,
}: {
  label: string;
  removeLabel: string;
  onRemove: () => void;
  mono?: boolean;
  icon?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-md bg-secondary pl-2 pr-1 text-xs text-secondary-foreground",
        mono && "font-mono font-medium",
      )}
    >
      {icon ? <MousePointer2 aria-hidden className="h-3 w-3 shrink-0" /> : null}
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="flex rounded p-0.5 hover:bg-background/60"
      >
        <X aria-hidden className="h-3 w-3" />
      </button>
    </span>
  );
}

/** A skill chip: sticky, so it reads apart from the per-message chips. */
function SkillChip({
  skill,
  removeLabel,
  onRemove,
}: {
  skill: SkillRef;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex h-6 max-w-full items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 pl-2 pr-1 text-xs font-medium text-primary">
      <Sparkles aria-hidden className="h-3 w-3 shrink-0" />
      <span className="truncate">{skill.name}</span>
      <SkillSourceBadge source={skill.source} className="border-primary/30 text-primary/80" />
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="flex rounded p-0.5 hover:bg-background/60"
      >
        <X aria-hidden className="h-3 w-3" />
      </button>
    </span>
  );
}
