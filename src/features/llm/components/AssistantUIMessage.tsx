"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { enUS, ptBR } from "date-fns/locale";
import { useTranslation } from "react-i18next";
import { Check, Copy, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLLMStore } from "@/features/llm";
import { getSuggestionIds } from "@/features/llm/message-parts";
import { mentionKey } from "@/features/llm/mentions/mention-ref";
import { messageToMarkdown } from "@/features/llm/message-markdown";
import { useChatActions } from "./chat-actions";
import { useAuiState, MessagePrimitive } from "@assistant-ui/react";
import {
  ERROR_DATA_PART,
  SUGGESTION_DATA_PART,
} from "@/features/llm/adapters/useAssistantUIAdapter";
import { ErrorPartView } from "./ErrorPart";
import { MarkdownText } from "./MarkdownText";
import { SuggestionPartView } from "./SuggestionPartView";
import { ToolCallGroup, ToolCallPartView } from "./ToolCallPart";

/** Text as Markdown; the Structura parts assistant-ui has no type for, by name. */
const ASSISTANT_PART_COMPONENTS = {
  Text: MarkdownText,
  tools: { Override: ToolCallPartView },
  ToolGroup: ToolCallGroup,
  data: {
    by_name: {
      [SUGGESTION_DATA_PART]: SuggestionPartView,
      [ERROR_DATA_PART]: ErrorPartView,
    },
  },
};

const COLLAPSE_THRESHOLD = 500;

function isDataPart(part: unknown): boolean {
  return typeof part === "object" && part !== null && "type" in part && part.type === "data";
}

function getPartText(message: { parts: readonly unknown[] }): string {
  for (const part of message.parts) {
    if (
      part &&
      typeof part === "object" &&
      "type" in part &&
      (part as { type: unknown }).type === "text" &&
      "text" in part &&
      typeof (part as { text: unknown }).text === "string"
    ) {
      return (part as { text: string }).text;
    }
  }
  return "";
}

export function UserMessageComponent() {
  const { i18n } = useTranslation();
  const message = useAuiState((s) => s.message);
  const locale = i18n.language === "pt-BR" ? ptBR : enUS;
  const timeAgo = formatDistanceToNow(message.createdAt, { addSuffix: true, locale });
  const text = getPartText(message);
  // Context chips live on the stored message, not in assistant-ui's copy.
  const stored = useLLMStore((state) =>
    state.messages.find((candidate) => candidate.id === message.id),
  );
  const mentions = stored?.mentions;
  const command = stored?.command;

  return (
    <div className="flex w-full min-w-0 justify-end">
      <div className="group relative max-w-[85%] min-w-0 pb-5">
        <div className="rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere] shadow-sm">
          {command ? (
            <span className="mr-1.5 inline-flex items-center rounded bg-primary-foreground/20 px-1.5 font-mono text-xs font-medium">
              /{command.name}
            </span>
          ) : null}
          {mentions && mentions.length > 0 ? (
            <span className="mb-1 flex flex-wrap gap-1">
              {mentions.map((ref) => (
                <span
                  key={mentionKey(ref)}
                  className="inline-flex items-center rounded bg-primary-foreground/20 px-1.5 text-xs font-medium"
                >
                  @{ref.label}
                </span>
              ))}
            </span>
          ) : null}
          <span>{text || (command ? "" : " ")}</span>
        </div>
        <span className="absolute -bottom-1 left-0 select-none whitespace-nowrap text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
          {timeAgo}
        </span>
      </div>
    </div>
  );
}

export function AssistantMessageComponent() {
  const { t, i18n } = useTranslation();
  const message = useAuiState((s) => s.message);
  const text = getPartText(message);
  const isStreaming = message.status?.type === "running";
  const isCancelled =
    message.status?.type === "incomplete" && message.status.reason === "cancelled";
  const isTruncated = message.status?.type === "incomplete" && message.status.reason === "length";
  const isComplete = message.status?.type === "complete" || isTruncated;
  const locale = i18n.language === "pt-BR" ? ptBR : enUS;
  const timeAgo = formatDistanceToNow(message.createdAt, { addSuffix: true, locale });
  const [isExpanded, setIsExpanded] = useState(false);
  // A suggestion card inside a collapsed bubble would hide its actions.
  const isLong =
    !isStreaming && text.length > COLLAPSE_THRESHOLD && !message.parts.some(isDataPart);

  if (isStreaming && text.length === 0) {
    return (
      <div className="flex w-full min-w-0 justify-start">
        <div className="group relative max-w-[85%] min-w-0 pb-5">
          <div className="rounded-2xl bg-secondary/60 px-4 py-3 text-secondary-foreground ring-1 ring-border/40">
            <GeneratingSkeleton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 justify-start">
      <div className="group relative max-w-[90%] min-w-0 pb-1">
        <div className="rounded-2xl bg-secondary/60 px-4 py-3 text-secondary-foreground ring-1 ring-border/40">
          <div className={cn("relative", !isExpanded && isLong && "max-h-52 overflow-hidden")}>
            {/* Text parts render as Markdown; suggestion parts as their card. */}
            <MessagePrimitive.Parts components={ASSISTANT_PART_COMPONENTS} />
            {!isExpanded && isLong ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-secondary/95 to-transparent" />
            ) : null}
          </div>
          {isLong ? (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1.5 text-[11px] text-primary hover:underline"
            >
              {isExpanded ? t("llmChat.showLess") : t("llmChat.showMore")}
            </button>
          ) : null}
        </div>
        {isCancelled ? (
          <p className="mt-1 px-1 text-[11px] text-muted-foreground">{t("llmChat.stopped")}</p>
        ) : null}
        {isTruncated ? (
          <p className="mt-1 px-1 text-[11px] text-muted-foreground">{t("llmChat.truncated")}</p>
        ) : null}
        <div className="mt-1 flex items-center gap-1 px-1">
          {isComplete || isCancelled ? <MessageActions messageId={message.id} /> : null}
          <span className="select-none whitespace-nowrap text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
            {timeAgo}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Under a finished assistant message: copy it as Markdown and, on the last
 * one, ask for a new reply. Regenerate is not offered while that message's
 * suggestion is still pending: its preview is on the canvas and replacing the
 * message would orphan it.
 */
function MessageActions({ messageId }: { messageId: string }) {
  const { t } = useTranslation();
  const { rerun } = useChatActions();
  const [copied, setCopied] = useState(false);
  const message = useLLMStore((state) =>
    state.messages.find((candidate) => candidate.id === messageId),
  );
  const isLastAssistant = useLLMStore((state) => {
    const assistants = state.messages.filter((candidate) => candidate.role === "assistant");
    return assistants[assistants.length - 1]?.id === messageId;
  });
  const isLoading = useLLMStore((state) => state.isLoading);
  const pendingSuggestions = useLLMStore((state) => state.pendingSuggestions);

  if (!message) {
    return null;
  }

  const findSuggestion = (id: string) =>
    pendingSuggestions.find((suggestion) => suggestion.id === id);
  const hasPendingSuggestion = getSuggestionIds(message).some(
    (id) => findSuggestion(id)?.status === "pending",
  );

  const copy = () => {
    const markdown = messageToMarkdown(message, { t, findSuggestion });
    void navigator.clipboard?.writeText(markdown).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
      <ActionButton label={t("llmChat.messageActions.copy")} onClick={copy}>
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      </ActionButton>
      {isLastAssistant && !isLoading && !hasPendingSuggestion ? (
        <ActionButton
          label={t("llmChat.messageActions.regenerate")}
          onClick={() => rerun(messageId)}
        >
          <RotateCcw className="h-3 w-3" />
        </ActionButton>
      ) : null}
    </>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function GeneratingSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 py-1.5" aria-label={t("llmChat.generating")}>
      {[100, 75, 55].map((width) => (
        <div
          key={width}
          className="h-2 animate-pulse rounded-full bg-muted"
          style={{ width: `${width}%` }}
        />
      ))}
    </div>
  );
}
