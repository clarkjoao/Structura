import { describe, expect, it } from "vitest";
import {
  appendTextDelta,
  getMessageText,
  getVisibleText,
  isErrorPart,
  isMessagePart,
  isSuggestionPart,
  isTextPart,
  isToolCallPart,
  migrateStoredMessage,
  migrateStoredMessages,
  textPart,
  type ErrorPart,
  type SuggestionPart,
  type ToolCallPart,
} from "./message-parts";
import type { ChatMessage } from "./types";

const toolCall: ToolCallPart = {
  type: "tool-call",
  id: "call-1",
  name: "search_elements",
  source: "internal",
  args: { query: "cache" },
  status: "done",
  result: [{ elementType: "aws-database" }],
};

const suggestion: SuggestionPart = { type: "suggestion", suggestionId: "s-1" };

const errorPart: ErrorPart = {
  type: "error",
  error: { kind: "timeout", status: null, mode: "direct", provider: "openai", detail: "" },
};

function assistant(parts: ChatMessage["parts"]): ChatMessage {
  return { id: "a", role: "assistant", parts, timestamp: 1 };
}

describe("message part guards", () => {
  it("recognises each part type and only that type", () => {
    expect(isTextPart(textPart("hi"))).toBe(true);
    expect(isToolCallPart(toolCall)).toBe(true);
    expect(isSuggestionPart(suggestion)).toBe(true);
    expect(isErrorPart(errorPart)).toBe(true);

    expect(isTextPart(toolCall)).toBe(false);
    expect(isToolCallPart(textPart("hi"))).toBe(false);
    expect(isSuggestionPart(errorPart)).toBe(false);
    expect(isErrorPart(suggestion)).toBe(false);
  });

  it("rejects malformed parts", () => {
    expect(isTextPart({ type: "text" })).toBe(false);
    expect(isToolCallPart({ ...toolCall, status: "finished" })).toBe(false);
    expect(isToolCallPart({ ...toolCall, source: "plugin" })).toBe(false);
    expect(isErrorPart({ type: "error", error: "boom" })).toBe(false);
    expect(isMessagePart({ type: "analysis", summary: "x" })).toBe(false);
    expect(isMessagePart(null)).toBe(false);
  });
});

describe("getMessageText", () => {
  it("joins the text parts in order and ignores the rest", () => {
    const message = assistant([textPart("Before "), toolCall, textPart("after"), suggestion]);
    expect(getMessageText(message)).toBe("Before after");
  });

  it("is empty for a message without text", () => {
    expect(getMessageText(assistant([errorPart]))).toBe("");
  });
});

describe("appendTextDelta", () => {
  it("extends the trailing text part", () => {
    const next = appendTextDelta(assistant([textPart("Hel")]), "lo");
    expect(next.parts).toEqual([textPart("Hello")]);
  });

  it("starts a new text part after a non-text part", () => {
    const next = appendTextDelta(assistant([toolCall]), "Done");
    expect(next.parts).toEqual([toolCall, textPart("Done")]);
  });

  it("does not modify its input", () => {
    const original = assistant([textPart("a")]);
    appendTextDelta(original, "b");
    expect(original.parts).toEqual([textPart("a")]);
  });

  it("returns the same message for an empty delta", () => {
    const original = assistant([textPart("a")]);
    expect(appendTextDelta(original, "")).toBe(original);
  });
});

describe("migrateStoredMessage", () => {
  it("turns legacy content into a text part", () => {
    const { message, changed } = migrateStoredMessage({
      id: "m1",
      role: "user",
      content: "Add a database",
      timestamp: 5,
    });
    expect(changed).toBe(true);
    expect(message).toEqual({
      id: "m1",
      role: "user",
      parts: [textPart("Add a database")],
      timestamp: 5,
    });
  });

  it("leaves a current message unchanged", () => {
    const current: ChatMessage = {
      id: "m2",
      role: "assistant",
      parts: [textPart("ok"), suggestion],
      timestamp: 6,
      status: "complete",
    };
    const { message, changed } = migrateStoredMessage(current);
    expect(changed).toBe(false);
    expect(message).toEqual(current);
  });

  it("keeps an unknown part as text with its raw value", () => {
    const { message, changed } = migrateStoredMessage({
      id: "m3",
      role: "assistant",
      parts: [{ type: "analysis", summary: "s" }],
      timestamp: 7,
    });
    expect(changed).toBe(true);
    expect(message.parts).toEqual([textPart('{"type":"analysis","summary":"s"}')]);
  });

  it("never drops a message, whatever its shape", () => {
    const { messages, changed } = migrateStoredMessages([
      { id: "ok", role: "user", content: "hi", timestamp: 1 },
      "a bare string",
      { id: "odd", role: "system", timestamp: 2 },
    ]);
    expect(changed).toBe(true);
    expect(messages).toHaveLength(3);
    expect(getMessageText(messages[1]!)).toBe("a bare string");
    expect(messages[2]?.role).toBe("assistant");
  });

  it("keeps a user message's mentions and drops invalid ones", () => {
    const { message, changed } = migrateStoredMessage({
      id: "u",
      role: "user",
      parts: [textPart("hi")],
      timestamp: 1,
      mentions: [{ kind: "node", id: "a", label: "A" }, { kind: "bogus" }],
    });
    expect(message.mentions).toEqual([{ kind: "node", id: "a", label: "A" }]);
    expect(changed).toBe(true);
    const again = migrateStoredMessage(message);
    expect(again.changed).toBe(false);
    expect(again.message.mentions).toEqual(message.mentions);
  });

  it("keeps a user message's skills and drops invalid ones", () => {
    const skill = { id: "local-1", source: "local", name: "Tone" };
    const { message, changed } = migrateStoredMessage({
      id: "u",
      role: "user",
      parts: [textPart("hi")],
      timestamp: 1,
      skills: [skill, { id: "x", source: "cloud", name: "Bad" }],
    });
    expect(message.skills).toEqual([skill]);
    expect(changed).toBe(true);
    expect(migrateStoredMessage(message).changed).toBe(false);
  });
});

describe("getVisibleText", () => {
  it("reads as sent: skills, then the command, then the text", () => {
    expect(
      getVisibleText({
        parts: [textPart("the API")],
        command: { id: "review", name: "review" },
        skills: [{ id: ".structura/skills/aws.md", source: "workspace", name: "AWS review" }],
      }),
    ).toBe("[AWS review] /review the API");
    expect(getVisibleText({ parts: [textPart("plain")] })).toBe("plain");
  });
});
