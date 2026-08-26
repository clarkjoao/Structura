"use client";

import { useCallback, useMemo } from "react";
import type {
  AppendMessage,
  ExternalStoreAdapter,
  StartRunConfig,
  TextMessagePart,
  ThreadAssistantMessage,
  ThreadMessage,
  ThreadSuggestion,
  ThreadUserMessage,
} from "@assistant-ui/core";
import { useLLMChat } from "@/features/canvas/chat";
import type { ChatMessage } from "@/features/llm/types";
import type { LLMErrorKind } from "@/features/llm/errors";

function isJsonEnvelope(text: string): boolean {
  const trimmed = text.trimStart();
  return trimmed.startsWith("{") && trimmed.endsWith("}");
}

function chatMessageToThreadMessage(msg: ChatMessage): ThreadMessage {
  const textPart: TextMessagePart = { type: "text", text: msg.content };
  if (msg.role === "user") {
    const userMsg: ThreadUserMessage = {
      id: msg.id,
      role: "user",
      content: [textPart],
      attachments: [],
      createdAt: new Date(msg.timestamp),
      metadata: { custom: {} },
    };
    return userMsg;
  }
  const assistantMsg: ThreadAssistantMessage = {
    id: msg.id,
    role: "assistant",
    content: [textPart],
    status: { type: "complete", reason: "stop" },
    createdAt: new Date(msg.timestamp),
    metadata: {
      unstable_state: null,
      unstable_annotations: [],
      unstable_data: [],
      steps: [],
      custom: {},
    },
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

function mapErrorToMessage(kind: LLMErrorKind): string {
  const messages: Record<LLMErrorKind, string> = {
    auth: "Authentication failed. Please check your API key.",
    rate_limit: "Rate limit exceeded. Please wait and try again.",
    cors: "CORS error. Please check your server configuration.",
    network: "Network error. Please check your connection.",
    model: "Model not found. Please check your model settings.",
    server: "Server error. Please try again later.",
    timeout: "Request timed out. Please try again.",
    unknown: "An unexpected error occurred.",
  };
  return messages[kind] ?? messages.unknown;
}

export interface AssistantUIAdapterState {
  messages: readonly ThreadMessage[];
  suggestions: readonly ThreadSuggestion[];
  isLoading: boolean;
  isRunning: boolean;
  error: string | null;
}

export function useAssistantUIAdapter(): ExternalStoreAdapter<ThreadMessage> {
  const {
    send,
    messages: chatMessages,
    isLoading,
    streamingContent,
    error: llmError,
    pendingSuggestions,
  } = useLLMChat({
    selectedNodeIds: new Set(),
    selectedNodeId: null,
  });

  const threadMessages = useMemo((): readonly ThreadMessage[] => {
    const lastAssistantIndex = [...chatMessages]
      .reverse()
      .findIndex((msg) => msg.role === "assistant");
    const actualAssistantIndex =
      lastAssistantIndex === -1 ? -1 : chatMessages.length - 1 - lastAssistantIndex;

    const isActivelyStreaming =
      streamingContent !== null &&
      streamingContent.length > 0 &&
      actualAssistantIndex !== -1;

    const baseMessages = isActivelyStreaming
      ? chatMessages.slice(0, actualAssistantIndex)
      : chatMessages;

    const baseThreadMessages = baseMessages.map(chatMessageToThreadMessage);

    if (!isActivelyStreaming || actualAssistantIndex === -1) {
      return baseThreadMessages;
    }

    const lastMsg = chatMessages[actualAssistantIndex];

    if (isJsonEnvelope(streamingContent)) {
      const emptyTextPart: TextMessagePart = { type: "text", text: "" };
      const streamingAssistant: ThreadAssistantMessage = {
        id: lastMsg.id,
        role: "assistant",
        content: [emptyTextPart],
        status: { type: "running" },
        createdAt: new Date(lastMsg.timestamp),
        metadata: {
          unstable_state: null,
          unstable_annotations: [],
          unstable_data: [],
          steps: [],
          custom: {},
        },
      };
      return [...baseThreadMessages, streamingAssistant];
    }

    const textPart: TextMessagePart = {
      type: "text",
      text: streamingContent,
      status: { type: "running" },
    };
    const streamingAssistant: ThreadAssistantMessage = {
      id: lastMsg.id,
      role: "assistant",
      content: [textPart],
      status: { type: "running" },
      createdAt: new Date(lastMsg.timestamp),
      metadata: {
        unstable_state: null,
        unstable_annotations: [],
        unstable_data: [],
        steps: [],
        custom: {},
      },
    };
    return [...baseThreadMessages, streamingAssistant];
  }, [chatMessages, streamingContent]);

  const suggestions = useMemo((): readonly ThreadSuggestion[] => {
    return pendingSuggestions
      .filter((s) => s.status === "pending")
      .map((s): ThreadSuggestion => ({
        title: s.patch.description || "Suggested change",
        prompt: `Accept suggestion ${s.id}`,
      }));
  }, [pendingSuggestions]);

  const errorMessage = useMemo((): string | null => {
    if (!llmError) return null;
    return mapErrorToMessage(llmError);
  }, [llmError]);

  const onNew = useCallback(
    async (message: AppendMessage): Promise<void> => {
      const text = extractTextFromAppendMessage(message);
      if (!text.trim()) return;
      await send(text, []);
    },
    [send],
  );

  const onCancel = useCallback(async (): Promise<void> => {
    // No-op: the underlying store does not yet expose cancellation.
  }, []);

  const onEdit = useCallback(
    async (message: AppendMessage): Promise<void> => {
      await onNew(message);
    },
    [onNew],
  );

  const onReload = useCallback(
    async (_parentId: string | null, _config: StartRunConfig): Promise<void> => {
      const lastUserMessage = [...chatMessages].reverse().find((msg) => msg.role === "user");
      if (lastUserMessage) {
        await send(lastUserMessage.content, []);
      }
    },
    [chatMessages, send],
  );

  const setMessages = useCallback(
    (_messages: readonly ThreadMessage[]) => {
      // The Structura store owns thread/messages lifecycle.
    },
    [],
  );

  return useMemo<ExternalStoreAdapter<ThreadMessage>>(
    () => ({
      messages: threadMessages,
      suggestions,
      isLoading,
      isRunning: isLoading && streamingContent !== null,
      error: errorMessage,
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
      errorMessage,
      onNew,
      onCancel,
      onEdit,
      onReload,
      setMessages,
    ],
  );
}
