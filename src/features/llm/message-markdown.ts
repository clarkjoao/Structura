import type { TFunction } from "i18next";
import { getLLMErrorI18nKey } from "./errors";
import {
  isErrorPart,
  isSuggestionPart,
  isTextPart,
  isToolCallPart,
  type MessagePart,
  type ToolCallStatus,
} from "./message-parts";
import { formatActionLabel } from "./patch-action-labels";
import { getVisibleText } from "./message-parts";
import type { ChatMessage, PendingSuggestion } from "./types";

export interface MarkdownContext {
  t: TFunction;
  /** Suggestions live in session state; a reloaded thread no longer has them. */
  findSuggestion: (suggestionId: string) => PendingSuggestion | undefined;
}

const TOOL_STATUS_KEYS: Record<ToolCallStatus, string> = {
  running: "llmChat.toolCall.status.running",
  done: "llmChat.toolCall.status.done",
  error: "llmChat.toolCall.status.error",
  "awaiting-approval": "llmChat.toolCall.status.awaitingApproval",
  denied: "llmChat.toolCall.status.denied",
};

export function toolCallStatusKey(status: ToolCallStatus): string {
  return TOOL_STATUS_KEYS[status];
}

function partToMarkdown(part: MessagePart, context: MarkdownContext): string {
  const { t } = context;
  if (isTextPart(part)) {
    return part.text;
  }
  if (isToolCallPart(part)) {
    return `> ${t("llmChat.copyExport.tool")}: ${part.name} — ${t(toolCallStatusKey(part.status))}`;
  }
  if (isSuggestionPart(part)) {
    const suggestion = context.findSuggestion(part.suggestionId);
    if (!suggestion) {
      return `> ${t("llmChat.copyExport.suggestionUnavailable")}`;
    }
    const title = suggestion.patch.description || t("llmChat.suggestion.defaultTitle");
    const items = suggestion.patch.actions.map((action) => `- ${formatActionLabel(action, t)}`);
    return [`**${title}**`, ...items].join("\n");
  }
  if (isErrorPart(part)) {
    const message = t(getLLMErrorI18nKey(part.error), { status: part.error.status });
    return `> ${t("llmChat.copyExport.error")}: ${message}`;
  }
  return "";
}

/** One message as Markdown: text as written, the other parts as short lines. */
export function messageToMarkdown(message: ChatMessage, context: MarkdownContext): string {
  // A command message reads as the user typed it: "/name text".
  if (message.role === "user" && message.command) {
    return getVisibleText(message);
  }
  return message.parts
    .map((part) => partToMarkdown(part, context))
    .filter((block) => block.trim().length > 0)
    .join("\n\n");
}

/** The whole conversation as Markdown, for `/copy`. */
export function conversationToMarkdown(messages: ChatMessage[], context: MarkdownContext): string {
  const { t } = context;
  const lines: string[] = [`# ${t("llmChat.copyExport.title")}\n`];
  for (const message of messages) {
    const role =
      message.role === "user"
        ? `**${t("llmChat.copyExport.user")}**`
        : `**${t("llmChat.copyExport.assistant")}**`;
    const time = new Date(message.timestamp).toLocaleString();
    lines.push(`\n${role} · ${time}\n${messageToMarkdown(message, context)}\n`);
  }
  return lines.join("");
}
