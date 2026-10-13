"use client";

import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type {
  AppendMessage,
  ExternalStoreAdapter,
  StartRunConfig,
  TextMessagePart,
  ThreadAssistantMessage,
  ThreadAssistantMessagePart,
  ThreadMessage,
  ThreadSuggestion,
  ThreadUserMessage,
} from "@assistant-ui/core";
import type { ChatMessage, CommandRef, PendingSuggestion } from "@/features/llm/types";
import type { MentionRef } from "@/features/llm/mentions/mention-ref";
import {
  getMessageText,
  isErrorPart,
  isSuggestionPart,
  isToolCallPart,
  type MessagePart,
  type MessageStatus,
} from "@/features/llm/message-parts";

/** Data-part names for the Structura parts assistant-ui has no type for. */
export const SUGGESTION_DATA_PART = "structura-suggestion";
export const ERROR_DATA_PART = "structura-error";

const EMPTY_METADATA: ThreadAssistantMessage["metadata"] = {
  unstable_state: null,
  unstable_annotations: [],
  unstable_data: [],
  steps: [],
  custom: {},
};

function toAssistantPart(part: MessagePart, running: boolean): ThreadAssistantMessagePart {
  if (isToolCallPart(part)) {
    // The renderer reads the Structura part back from `artifact`; the
    // assistant-ui fields are filled so the runtime treats it as a tool call.
    return {
      type: "tool-call",
      toolCallId: part.id,
      toolName: part.name,
      args: {},
      argsText: safeStringify(part.args),
      result: part.result,
      isError: part.status === "error",
      artifact: part,
    };
  }
  if (isSuggestionPart(part)) {
    return { type: "data", name: SUGGESTION_DATA_PART, data: part };
  }
  if (isErrorPart(part)) {
    return { type: "data", name: ERROR_DATA_PART, data: part };
  }
  return running
    ? { type: "text", text: part.text, status: { type: "running" } }
    : { type: "text", text: part.text };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}

function toAssistantStatus(status: MessageStatus | undefined): ThreadAssistantMessage["status"] {
  switch (status) {
    case "streaming":
      return { type: "running" };
    case "cancelled":
      return { type: "incomplete", reason: "cancelled" };
    case "error":
      return { type: "incomplete", reason: "error" };
    default:
      return { type: "complete", reason: "stop" };
  }
}

function chatMessageToThreadMessage(msg: ChatMessage): ThreadMessage {
  if (msg.role === "user") {
    const userMsg: ThreadUserMessage = {
      id: msg.id,
      role: "user",
      content: [{ type: "text", text: getMessageText(msg) }],
      attachments: [],
      createdAt: new Date(msg.timestamp),
      metadata: { custom: {} },
    };
    return userMsg;
  }
  const running = msg.status === "streaming";
  const assistantMsg: ThreadAssistantMessage = {
    id: msg.id,
    role: "assistant",
    content: msg.parts.map((part) => toAssistantPart(part, running)),
    status: msg.truncated
      ? { type: "incomplete", reason: "length" }
      : toAssistantStatus(msg.status),
    createdAt: new Date(msg.timestamp),
    metadata: EMPTY_METADATA,
  };
  return assistantMsg;
}

function extractTextFromAppendMessage(message: AppendMessage): string {
  const content = message.content;
  if (Array.isArray(content)) {
    return content
      .filter((part): part is TextMessagePart => part.type === "text")
      .map((part) => part.text)
      .join("");
  }
  if (typeof content === "string") return content;
  return "";
}

/**
 * The slice of `useLLMChat` the assistant-ui adapter needs. The chat panel
 * calls `useLLMChat` once and passes the result in, so the hook only runs
 * once per panel (F25).
 */
export interface AssistantUIAdapterDeps {
  send: (
    text: string,
    mentions: MentionRef[],
    command?: CommandRef,
  ) => Promise<boolean | void>;
  cancel: () => void;
  rerun: (assistantMessageId: string) => Promise<void>;
  messages: ChatMessage[];
  isLoading: boolean;
  streamingContent: string | null;
  pendingSuggestions: PendingSuggestion[];
}

export function useAssistantUIAdapter(deps: AssistantUIAdapterDeps): ExternalStoreAdapter<ThreadMessage> {
  const { t } = useTranslation();
  const { send, cancel, rerun, messages: chatMessages, isLoading, streamingContent, pendingSuggestions } =
    deps;

  const threadMessages = useMemo(
    (): readonly ThreadMessage[] => chatMessages.map(chatMessageToThreadMessage),
    [chatMessages],
  );

  const suggestions = useMemo((): readonly ThreadSuggestion[] => {
    return pendingSuggestions
      .filter((s) => s.status === "pending")
      .map((s): ThreadSuggestion => ({
        title: s.patch.description || t("llmChat.suggestion.defaultTitle"),
        prompt: `Accept suggestion ${s.id}`,
      }));
  }, [pendingSuggestions, t]);

  const onNew = useCallback(
    async (message: AppendMessage): Promise<void> => {
      const text = extractTextFromAppendMessage(message);
      if (!text.trim()) return;
      await send(text, []);
    },
    [send],
  );

  const onCancel = useCallback(async (): Promise<void> => {
    cancel();
  }, [cancel]);

  const onEdit = useCallback(
    async (message: AppendMessage): Promise<void> => {
      await onNew(message);
    },
    [onNew],
  );

  // Errors are shown inside the conversation (error parts), so the adapter
  // reports none of its own. Reload regenerates the last assistant message.
  const onReload = useCallback(
    async (_parentId: string | null, _config: StartRunConfig): Promise<void> => {
      const lastAssistant = [...chatMessages].reverse().find((msg) => msg.role === "assistant");
      if (lastAssistant) {
        await rerun(lastAssistant.id);
      }
    },
    [chatMessages, rerun],
  );

  const setMessages = useCallback((_messages: readonly ThreadMessage[]) => {
    // The Structura store owns thread/messages lifecycle.
  }, []);

  return useMemo<ExternalStoreAdapter<ThreadMessage>>(
    () => ({
      messages: threadMessages,
      suggestions,
      isLoading,
      isRunning: isLoading && streamingContent !== null,
      onNew,
      onCancel,
      onEdit,
      onReload,
      setMessages,
      isSendDisabled: false,
      isDisabled: false,
    }),
    [
      threadMessages,
      suggestions,
      isLoading,
      streamingContent,
      onNew,
      onCancel,
      onEdit,
      onReload,
      setMessages,
    ],
  );
}
