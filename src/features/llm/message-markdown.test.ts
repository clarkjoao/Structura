import { describe, expect, it } from "vitest";
import i18n from "@/infrastructure/i18n";
import { conversationToMarkdown, messageToMarkdown } from "./message-markdown";
import type { ChatMessage, PendingSuggestion } from "./types";

const suggestion: PendingSuggestion = {
  id: "s-1",
  messageId: "a-1",
  status: "pending",
  patch: {
    id: "p-1",
    description: "Add a cache",
    actions: [
      {
        type: "ADD_NODE",
        payload: { ref: "new-1", nodeType: "container", name: "Redis", parentId: null },
      },
      { type: "REMOVE_EDGE", payload: { edgeId: "e-9" } },
    ],
  },
};

const messages: ChatMessage[] = [
  { id: "u-1", role: "user", parts: [{ type: "text", text: "Add a cache" }], timestamp: 0 },
  {
    id: "a-1",
    role: "assistant",
    status: "complete",
    timestamp: 1,
    parts: [
      { type: "text", text: "Here is **the plan**:" },
      {
        type: "tool-call",
        id: "c-1",
        name: "search_elements",
        source: "internal",
        args: { query: "redis" },
        status: "done",
      },
      { type: "suggestion", suggestionId: "s-1" },
    ],
  },
  {
    id: "a-2",
    role: "assistant",
    status: "error",
    timestamp: 2,
    parts: [
      {
        type: "error",
        error: { kind: "timeout", status: null, mode: "direct", provider: "openai", detail: "" },
      },
    ],
  },
];

const context = {
  t: i18n.t.bind(i18n),
  findSuggestion: (id: string) => (id === suggestion.id ? suggestion : undefined),
};

describe("message Markdown", () => {
  it("serialises text as-is and other parts as short lines", () => {
    const t = context.t;
    expect(messageToMarkdown(messages[1]!, context)).toBe(
      [
        "Here is **the plan**:",
        `> ${t("llmChat.copyExport.tool")}: search_elements — ${t("llmChat.toolCall.status.done")}`,
        [
          "**Add a cache**",
          "- Redis (container)",
          `- ${t("llmChat.suggestion.action.removeEdge", { edgeId: "e-9" })}`,
        ].join("\n"),
      ].join("\n\n"),
    );
    expect(messageToMarkdown(messages[2]!, context)).toBe(
      `> ${t("llmChat.copyExport.error")}: ${t("llmChat.error.timeout")}`,
    );
  });

  it("notes a suggestion that is no longer in the session", () => {
    const md = messageToMarkdown(messages[1]!, { ...context, findSuggestion: () => undefined });
    expect(md).toContain(`> ${context.t("llmChat.copyExport.suggestionUnavailable")}`);
  });

  it("copies the whole conversation with role headings", () => {
    const md = conversationToMarkdown(messages, context);
    expect(md.startsWith(`# ${context.t("llmChat.copyExport.title")}`)).toBe(true);
    expect(md).toContain(`**${context.t("llmChat.copyExport.user")}**`);
    expect(md).toContain("Add a cache");
    expect(md).toContain("> ");
  });
});
